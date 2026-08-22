#include "webview/webview_host.h"
#include "common/utf8.h"
#include <ShlObj.h>
#include <Shlwapi.h>
#include <algorithm>
#include <filesystem>
#include <fstream>
#include <iterator>
#include <sstream>
#include <string_view>
#include <vector>
using Microsoft::WRL::Callback;
namespace {
std::wstring UserDataFolder() {
  PWSTR local = nullptr;
  if (FAILED(SHGetKnownFolderPath(FOLDERID_LocalAppData, KF_FLAG_CREATE, nullptr, &local))) return L"";
  std::filesystem::path path = std::filesystem::path(local) / L"lw.MD" / L"WebView2"; CoTaskMemFree(local);
  std::filesystem::create_directories(path); return path.wstring();
}
bool DevToolsEnabled() {
  wchar_t value[8]{};
  const auto length = GetEnvironmentVariableW(L"LWMD_ENABLE_DEVTOOLS", value,
                                               static_cast<DWORD>(std::size(value)));
  return length == 1 && value[0] == L'1';
}
std::string PercentDecode(const std::wstring& input) {
  std::string output;
  output.reserve(input.size());
  const auto hex = [](const wchar_t value) -> int {
    if (value >= L'0' && value <= L'9') return value - L'0';
    if (value >= L'a' && value <= L'f') return value - L'a' + 10;
    if (value >= L'A' && value <= L'F') return value - L'A' + 10;
    return -1;
  };
  for (std::size_t index = 0; index < input.size(); ++index) {
    if (input[index] == L'%' && index + 2 < input.size()) {
      const auto high = hex(input[index + 1]);
      const auto low = hex(input[index + 2]);
      if (high >= 0 && low >= 0) {
        output.push_back(static_cast<char>((high << 4) | low));
        index += 2;
        continue;
      }
    }
    if (input[index] <= 0x7f) output.push_back(static_cast<char>(input[index]));
    else output += WideToUtf8(std::wstring(1, input[index]));
  }
  return output;
}
bool IsSafeRelativePath(const std::filesystem::path& path) {
  if (path.empty() || path.is_absolute() || path.has_root_name()) return false;
  return std::none_of(path.begin(), path.end(), [](const auto& part) { return part == L".."; });
}
std::wstring ImageContentType(const std::filesystem::path& path) {
  auto extension = path.extension().wstring();
  std::transform(extension.begin(), extension.end(), extension.begin(), towlower);
  if (extension == L".png") return L"image/png";
  if (extension == L".jpg" || extension == L".jpeg") return L"image/jpeg";
  if (extension == L".gif") return L"image/gif";
  if (extension == L".webp") return L"image/webp";
  if (extension == L".bmp") return L"image/bmp";
  if (extension == L".svg") return L"image/svg+xml";
  return L"";
}
}
WebViewHost::~WebViewHost() {
  if (webview_) { webview_->remove_WebMessageReceived(message_token_); webview_->remove_WebResourceRequested(resource_token_); }
  if (controller_) controller_->Close();
}
void WebViewHost::Create(HWND window, const std::wstring& content_folder,
                         MessageHandler on_message) {
  window_ = window; on_message_ = std::move(on_message); const auto user_data = UserDataFolder();
  CreateCoreWebView2EnvironmentWithOptions(nullptr, user_data.c_str(), nullptr, Callback<ICoreWebView2CreateCoreWebView2EnvironmentCompletedHandler>([this, content_folder](HRESULT result, ICoreWebView2Environment* environment) -> HRESULT {
    if (FAILED(result) || !environment) { MessageBoxW(window_, L"未找到 WebView2 Runtime。请安装 Microsoft Edge WebView2 Evergreen Runtime。", L"lw.MD", MB_OK | MB_ICONERROR); return result; }
    environment_ = environment;
    environment->QueryInterface(IID_PPV_ARGS(&print_environment_));
    return environment->CreateCoreWebView2Controller(window_, Callback<ICoreWebView2CreateCoreWebView2ControllerCompletedHandler>([this, content_folder](HRESULT status, ICoreWebView2Controller* controller) -> HRESULT {
      if (FAILED(status) || !controller) return status;
      controller_ = controller; controller_->get_CoreWebView2(&webview_);
      Microsoft::WRL::ComPtr<ICoreWebView2Controller4> controller4;
      if (SUCCEEDED(controller_.As(&controller4))) controller4->put_AllowExternalDrop(TRUE);
      Microsoft::WRL::ComPtr<ICoreWebView2Settings> settings; if (SUCCEEDED(webview_->get_Settings(&settings))) { settings->put_AreDevToolsEnabled(DevToolsEnabled() ? TRUE : FALSE); settings->put_IsStatusBarEnabled(FALSE); }
      Microsoft::WRL::ComPtr<ICoreWebView2_3> webview3; if (SUCCEEDED(webview_.As(&webview3))) webview3->SetVirtualHostNameToFolderMapping(L"app.lwmd", content_folder.c_str(), COREWEBVIEW2_HOST_RESOURCE_ACCESS_KIND_DENY_CORS);
      webview_->AddWebResourceRequestedFilter(L"https://document.lwmd/*",
                                              COREWEBVIEW2_WEB_RESOURCE_CONTEXT_ALL);
      webview_->add_WebResourceRequested(
          Callback<ICoreWebView2WebResourceRequestedEventHandler>(
              [this](ICoreWebView2*, ICoreWebView2WebResourceRequestedEventArgs* args) -> HRESULT {
                Microsoft::WRL::ComPtr<ICoreWebView2WebResourceRequest> request;
                LPWSTR raw_uri = nullptr;
                if (FAILED(args->get_Request(&request)) || !request ||
                    FAILED(request->get_Uri(&raw_uri)) || !raw_uri || !environment_) {
                  if (raw_uri) CoTaskMemFree(raw_uri);
                  return S_OK;
                }
                std::wstring uri(raw_uri);
                CoTaskMemFree(raw_uri);
                constexpr std::wstring_view prefix = L"https://document.lwmd/";
                auto encoded = uri.substr(prefix.size());
                const auto query = encoded.find_first_of(L"?#");
                if (query != std::wstring::npos) encoded.resize(query);
                const auto relative = std::filesystem::path(
                                          Utf8ToWide(PercentDecode(encoded)))
                                          .lexically_normal();
                const auto target = document_root_ / relative;
                const auto content_type = ImageContentType(target);
                Microsoft::WRL::ComPtr<ICoreWebView2WebResourceResponse> response;
                if (IsSafeRelativePath(relative) && !document_root_.empty() &&
                    !content_type.empty() && std::filesystem::is_regular_file(target)) {
                  std::ifstream input(target, std::ios::binary);
                  const std::vector<unsigned char> bytes{
                      std::istreambuf_iterator<char>(input), std::istreambuf_iterator<char>()};
                  Microsoft::WRL::ComPtr<IStream> stream;
                  stream.Attach(
                      SHCreateMemStream(bytes.data(), static_cast<UINT>(bytes.size())));
                  const auto headers = L"Content-Type: " + content_type +
                                       L"\r\nCache-Control: no-cache";
                  environment_->CreateWebResourceResponse(stream.Get(), 200, L"OK",
                                                          headers.c_str(), &response);
                } else {
                  environment_->CreateWebResourceResponse(nullptr, 404, L"Not Found",
                                                          L"Content-Type: text/plain", &response);
                }
                if (response) args->put_Response(response.Get());
                return S_OK;
              })
              .Get(),
          &resource_token_);
      webview_->add_WebMessageReceived(Callback<ICoreWebView2WebMessageReceivedEventHandler>([this](ICoreWebView2*, ICoreWebView2WebMessageReceivedEventArgs* args) -> HRESULT {
        LPWSTR json = nullptr; if (SUCCEEDED(args->get_WebMessageAsJson(&json)) && json) { const auto request = WideToUtf8(json); CoTaskMemFree(json); if (on_message_) { const auto target = webview_; on_message_(request, [target](const std::string& reply) { if (!reply.empty() && target) { const auto wide_reply = Utf8ToWide(reply); target->PostWebMessageAsJson(wide_reply.c_str()); } }); } }
        return S_OK;
      }).Get(), &message_token_);
      Resize(); webview_->Navigate(L"https://app.lwmd/index.html"); return S_OK;
    }).Get());
  }).Get());
}
void WebViewHost::ExportPdf(const std::wstring& path, PdfExportCompletion completion) {
  Microsoft::WRL::ComPtr<ICoreWebView2_7> webview7;
  if (!webview_ || FAILED(webview_.As(&webview7)) || !print_environment_) { completion(E_NOINTERFACE, false); return; }
  Microsoft::WRL::ComPtr<ICoreWebView2PrintSettings> settings;
  const auto settings_result = print_environment_->CreatePrintSettings(&settings);
  if (FAILED(settings_result) || !settings) { completion(settings_result, false); return; }
  settings->put_Orientation(COREWEBVIEW2_PRINT_ORIENTATION_PORTRAIT);
  settings->put_PageWidth(8.27);
  settings->put_PageHeight(11.69);
  settings->put_ScaleFactor(1.0);
  settings->put_MarginTop(0.59);
  settings->put_MarginBottom(0.59);
  settings->put_MarginLeft(0.59);
  settings->put_MarginRight(0.59);
  settings->put_ShouldPrintBackgrounds(TRUE);
  settings->put_ShouldPrintSelectionOnly(FALSE);
  settings->put_ShouldPrintHeaderAndFooter(FALSE);
  const auto started = webview7->PrintToPdf(path.c_str(), settings.Get(), Callback<ICoreWebView2PrintToPdfCompletedHandler>([completion](const HRESULT error, const BOOL success) -> HRESULT { completion(error, success == TRUE); return S_OK; }).Get());
  if (FAILED(started)) completion(started, false);
}
void WebViewHost::SetDocumentFolder(const std::wstring& document_path) {
  document_root_ = std::filesystem::path(document_path).parent_path();
}
bool WebViewHost::PostJson(const std::string& message) {
  if (!webview_) return false;
  const auto wide = Utf8ToWide(message);
  return SUCCEEDED(webview_->PostWebMessageAsJson(wide.c_str()));
}
void WebViewHost::Resize() { if (!controller_ || !window_) return; RECT bounds{}; GetClientRect(window_, &bounds); controller_->put_Bounds(bounds); }

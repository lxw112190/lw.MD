#pragma once
#include <Windows.h>
#include <Unknwn.h>
#include <WebView2.h>
#include <wrl.h>
#include <functional>
#include <filesystem>
#include <string>
#include <utility>
#include <vector>
class WebViewHost {
 public:
  using Reply = std::function<void(const std::string&)>;
  using MessageHandler = std::function<void(const std::string&, Reply)>;
  using PdfExportCompletion = std::function<void(HRESULT, bool)>;

  ~WebViewHost();
  void Create(HWND window, const std::wstring& content_folder, MessageHandler on_message);
  void ExportPdf(const std::wstring& path, PdfExportCompletion completion);
  void SetDocumentFolder(const std::wstring& document_path);
  bool PostJson(const std::string& message);
  void Resize();
 private:
  HWND window_ = nullptr;
  MessageHandler on_message_;
  Microsoft::WRL::ComPtr<ICoreWebView2Controller> controller_;
  Microsoft::WRL::ComPtr<ICoreWebView2> webview_;
  Microsoft::WRL::ComPtr<ICoreWebView2Environment> environment_;
  Microsoft::WRL::ComPtr<ICoreWebView2Environment6> print_environment_;
  EventRegistrationToken message_token_{};
  EventRegistrationToken resource_token_{};
  EventRegistrationToken navigation_token_{};
  EventRegistrationToken frame_navigation_token_{};
  EventRegistrationToken new_window_token_{};
  EventRegistrationToken permission_token_{};
  std::filesystem::path document_root_;
};

#include "dialogs/file_dialog.h"
#include <ShObjIdl.h>
#include <filesystem>

namespace {
std::optional<std::wstring> ResultPath(IFileDialog* dialog) {
  IShellItem* item = nullptr;
  if (FAILED(dialog->GetResult(&item))) return std::nullopt;
  PWSTR raw = nullptr;
  const auto success = SUCCEEDED(item->GetDisplayName(SIGDN_FILESYSPATH, &raw)) && raw;
  std::wstring result = success ? raw : L"";
  if (raw) CoTaskMemFree(raw);
  item->Release();
  return success ? std::optional<std::wstring>(result) : std::nullopt;
}
void Configure(IFileDialog* dialog, const wchar_t* title, const COMDLG_FILTERSPEC* types,
               const UINT type_count) {
  DWORD options{}; dialog->GetOptions(&options);
  dialog->SetOptions(options | FOS_FORCEFILESYSTEM | FOS_PATHMUSTEXIST | FOS_NOCHANGEDIR);
  dialog->SetTitle(title);
  dialog->SetFileTypes(type_count, types);
  dialog->SetFileTypeIndex(1);
}
}
std::optional<std::wstring> ChooseMarkdownFile(HWND owner) {
  IFileOpenDialog* dialog = nullptr;
  if (FAILED(CoCreateInstance(CLSID_FileOpenDialog, nullptr, CLSCTX_INPROC_SERVER, IID_PPV_ARGS(&dialog)))) return std::nullopt;
  const COMDLG_FILTERSPEC types[] = {{L"Markdown (*.md;*.markdown)", L"*.md;*.markdown"}, {L"All Files (*.*)", L"*.*"}};
  Configure(dialog, L"打开 Markdown 文件", types, static_cast<UINT>(std::size(types)));
  const HRESULT shown = dialog->Show(owner);
  const auto result = shown == HRESULT_FROM_WIN32(ERROR_CANCELLED) ? std::nullopt : (SUCCEEDED(shown) ? ResultPath(dialog) : std::nullopt);
  dialog->Release(); return result;
}
std::optional<std::vector<std::wstring>> ChooseImageFiles(HWND owner) {
  IFileOpenDialog* dialog = nullptr;
  if (FAILED(CoCreateInstance(CLSID_FileOpenDialog, nullptr,
                              CLSCTX_INPROC_SERVER,
                              IID_PPV_ARGS(&dialog)))) {
    return std::nullopt;
  }
  const COMDLG_FILTERSPEC types[] = {
      {L"图片文件", L"*.png;*.jpg;*.jpeg;*.gif;*.webp;*.bmp;*.svg"},
      {L"所有文件 (*.*)", L"*.*"}};
  Configure(dialog, L"插入图片", types, static_cast<UINT>(std::size(types)));
  DWORD options{};
  if (SUCCEEDED(dialog->GetOptions(&options))) {
    dialog->SetOptions(options | FOS_ALLOWMULTISELECT | FOS_FILEMUSTEXIST);
  }
  const auto shown = dialog->Show(owner);
  if (shown == HRESULT_FROM_WIN32(ERROR_CANCELLED)) {
    dialog->Release();
    return std::nullopt;
  }
  if (FAILED(shown)) {
    dialog->Release();
    return std::nullopt;
  }
  IShellItemArray* items = nullptr;
  if (FAILED(dialog->GetResults(&items)) || !items) {
    dialog->Release();
    return std::nullopt;
  }
  DWORD count = 0;
  if (FAILED(items->GetCount(&count)) || count == 0 || count > 64) {
    items->Release();
    dialog->Release();
    return std::nullopt;
  }
  std::vector<std::wstring> result;
  result.reserve(count);
  for (DWORD index = 0; index < count; ++index) {
    IShellItem* item = nullptr;
    PWSTR raw = nullptr;
    if (FAILED(items->GetItemAt(index, &item)) || !item ||
        FAILED(item->GetDisplayName(SIGDN_FILESYSPATH, &raw)) || !raw) {
      if (raw) CoTaskMemFree(raw);
      if (item) item->Release();
      result.clear();
      break;
    }
    result.emplace_back(raw);
    CoTaskMemFree(raw);
    item->Release();
  }
  items->Release();
  dialog->Release();
  return result.empty() ? std::nullopt
                        : std::optional<std::vector<std::wstring>>(result);
}
std::optional<std::wstring> ChooseMarkdownSavePath(HWND owner, const std::wstring& suggested_name) {
  IFileSaveDialog* dialog = nullptr;
  if (FAILED(CoCreateInstance(CLSID_FileSaveDialog, nullptr, CLSCTX_INPROC_SERVER, IID_PPV_ARGS(&dialog)))) return std::nullopt;
  const COMDLG_FILTERSPEC types[] = {{L"Markdown (*.md;*.markdown)", L"*.md;*.markdown"}, {L"All Files (*.*)", L"*.*"}};
  Configure(dialog, L"另存为 Markdown 文件", types, static_cast<UINT>(std::size(types))); dialog->SetFileName(suggested_name.empty() ? L"未命名.md" : suggested_name.c_str()); dialog->SetDefaultExtension(L"md");
  const HRESULT shown = dialog->Show(owner);
  const auto result = shown == HRESULT_FROM_WIN32(ERROR_CANCELLED) ? std::nullopt : (SUCCEEDED(shown) ? ResultPath(dialog) : std::nullopt);
  dialog->Release(); return result;
}
std::optional<std::wstring> ChoosePdfSavePath(HWND owner, const std::wstring& suggested_name) {
  IFileSaveDialog* dialog = nullptr;
  if (FAILED(CoCreateInstance(CLSID_FileSaveDialog, nullptr, CLSCTX_INPROC_SERVER,
                              IID_PPV_ARGS(&dialog)))) return std::nullopt;
  const COMDLG_FILTERSPEC types[] = {{L"PDF 文档 (*.pdf)", L"*.pdf"}};
  Configure(dialog, L"导出 PDF", types, static_cast<UINT>(std::size(types)));
  dialog->SetFileName(suggested_name.empty() ? L"未命名.pdf" : suggested_name.c_str());
  dialog->SetDefaultExtension(L"pdf");
  const HRESULT shown = dialog->Show(owner);
  const auto result = shown == HRESULT_FROM_WIN32(ERROR_CANCELLED)
                          ? std::nullopt
                          : (SUCCEEDED(shown) ? ResultPath(dialog) : std::nullopt);
  dialog->Release();
  return result;
}

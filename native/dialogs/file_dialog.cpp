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

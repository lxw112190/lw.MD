#include "dragdrop/file_drop_target.h"

#include <Shellapi.h>

#include <atomic>
#include <utility>

namespace {
bool SupportsFileDrop(IDataObject* data_object) {
  if (!data_object) return false;
  FORMATETC format{CF_HDROP, nullptr, DVASPECT_CONTENT, -1, TYMED_HGLOBAL};
  return data_object->QueryGetData(&format) == S_OK;
}

void SetDropEffect(DWORD* effect, const bool accepted) {
  if (!effect) return;
  *effect = accepted && (*effect & DROPEFFECT_COPY) ? DROPEFFECT_COPY
                                                    : DROPEFFECT_NONE;
}

std::vector<std::filesystem::path> ReadFileDrop(IDataObject* data_object) {
  std::vector<std::filesystem::path> paths;
  if (!SupportsFileDrop(data_object)) return paths;

  FORMATETC format{CF_HDROP, nullptr, DVASPECT_CONTENT, -1, TYMED_HGLOBAL};
  STGMEDIUM medium{};
  if (FAILED(data_object->GetData(&format, &medium))) return paths;

  const auto drop = static_cast<HDROP>(GlobalLock(medium.hGlobal));
  if (drop) {
    paths = ExtractDroppedFilePaths(drop);
    GlobalUnlock(medium.hGlobal);
  }
  ReleaseStgMedium(&medium);
  return paths;
}

class FileDropTarget final : public IDropTarget {
 public:
  FileDropTarget(FileDropHandler handler, FileDragStateHandler state_handler)
      : handler_(std::move(handler)),
        state_handler_(std::move(state_handler)) {}

  HRESULT STDMETHODCALLTYPE QueryInterface(REFIID interface_id,
                                            void** object) override {
    if (!object) return E_POINTER;
    *object = nullptr;
    if (interface_id == IID_IUnknown || interface_id == IID_IDropTarget) {
      *object = static_cast<IDropTarget*>(this);
      AddRef();
      return S_OK;
    }
    return E_NOINTERFACE;
  }

  ULONG STDMETHODCALLTYPE AddRef() override { return ++references_; }

  ULONG STDMETHODCALLTYPE Release() override {
    const auto remaining = --references_;
    if (remaining == 0) delete this;
    return remaining;
  }

  HRESULT STDMETHODCALLTYPE DragEnter(IDataObject* data_object, DWORD,
                                      POINTL, DWORD* effect) override {
    accepting_ = SupportsFileDrop(data_object);
    NotifyDragState(accepting_);
    SetDropEffect(effect, accepting_);
    return S_OK;
  }

  HRESULT STDMETHODCALLTYPE DragOver(DWORD, POINTL, DWORD* effect) override {
    SetDropEffect(effect, accepting_);
    return S_OK;
  }

  HRESULT STDMETHODCALLTYPE DragLeave() override {
    accepting_ = false;
    NotifyDragState(false);
    return S_OK;
  }

  HRESULT STDMETHODCALLTYPE Drop(IDataObject* data_object, DWORD, POINTL,
                                 DWORD* effect) override {
    auto paths = ReadFileDrop(data_object);
    accepting_ = false;
    NotifyDragState(false);
    SetDropEffect(effect, !paths.empty());
    if (paths.empty()) return S_OK;
    try {
      handler_(paths);
      return S_OK;
    } catch (...) {
      if (effect) *effect = DROPEFFECT_NONE;
      return E_FAIL;
    }
  }

 private:
  void NotifyDragState(const bool active) {
    if (drag_active_ == active) return;
    drag_active_ = active;
    try {
      if (state_handler_) state_handler_(active);
    } catch (...) {
    }
  }

  std::atomic<ULONG> references_{1};
  FileDropHandler handler_;
  FileDragStateHandler state_handler_;
  bool accepting_ = false;
  bool drag_active_ = false;
};
}  // namespace

Microsoft::WRL::ComPtr<IDropTarget> CreateFileDropTarget(
    FileDropHandler handler, FileDragStateHandler state_handler) {
  Microsoft::WRL::ComPtr<IDropTarget> target;
  target.Attach(
      new FileDropTarget(std::move(handler), std::move(state_handler)));
  return target;
}

std::vector<std::filesystem::path> ExtractDroppedFilePaths(HDROP drop) {
  std::vector<std::filesystem::path> paths;
  if (!drop) return paths;
  const auto count = DragQueryFileW(drop, 0xFFFFFFFF, nullptr, 0);
  paths.reserve(count);
  for (UINT index = 0; index < count; ++index) {
    const auto length = DragQueryFileW(drop, index, nullptr, 0);
    std::wstring path(length + 1, L'\0');
    DragQueryFileW(drop, index, path.data(), length + 1);
    path.resize(length);
    paths.emplace_back(std::move(path));
  }
  return paths;
}

#pragma once
#include <Windows.h>
#include <cstdint>
#include <filesystem>
#include <functional>
#include <string>
#include <unordered_map>
#include <utility>
#include <vector>

struct DroppedFileGrantInfo {
  std::string id;
  std::string name;
  std::string kind;
  std::uintmax_t size = 0;
};

class BridgeDispatcher {
 public:
  using Reply = std::function<void(const std::string&)>;
  using PdfExportCompletion = std::function<void(HRESULT, bool)>;
  using PdfExporter = std::function<void(const std::wstring&, PdfExportCompletion)>;
  using DocumentMapper = std::function<void(const std::wstring&)>;

  BridgeDispatcher(HWND owner, PdfExporter pdf_exporter, DocumentMapper document_mapper)
      : owner_(owner),
        pdf_exporter_(std::move(pdf_exporter)),
        document_mapper_(std::move(document_mapper)) {}
  void Dispatch(const std::string& request, Reply reply);
  void SetLaunchDocumentPath(const std::wstring& path);
  void SetCurrentDocumentPath(const std::wstring& path);
  std::vector<DroppedFileGrantInfo> GrantDroppedFiles(
      const std::vector<std::filesystem::path>& paths);

 private:
  struct DroppedFileGrant {
    std::filesystem::path path;
    std::string kind;
  };

  HWND owner_;
  PdfExporter pdf_exporter_;
  DocumentMapper document_mapper_;
  std::wstring launch_document_path_;
  std::wstring current_document_path_;
  std::unordered_map<std::string, DroppedFileGrant> dropped_file_grants_;
};

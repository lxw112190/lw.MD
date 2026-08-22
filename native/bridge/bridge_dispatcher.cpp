#include "bridge/bridge_dispatcher.h"
#include "common/app_state.h"
#include "common/utf8.h"
#include "dialogs/file_dialog.h"
#include "filesystem/file_service.h"
#include "images/image_service.h"
#include "settings/settings.h"
#include <filesystem>
#include <nlohmann/json.hpp>
using json = nlohmann::json;
namespace {
json Error(const std::string& id, const char* code, const char* message) { return {{"type", "response"}, {"id", id}, {"ok", false}, {"error", {{"code", code}, {"message", message}}}}; }
json Success(const std::string& id, json result) { return {{"type", "response"}, {"id", id}, {"ok", true}, {"result", std::move(result)}}; }
json ImageJson(const SavedImage& image) {
  return {{"path", WideToUtf8(image.absolute_path)},
          {"relativePath", WideToUtf8(image.relative_path)}};
}
}
void BridgeDispatcher::Dispatch(const std::string& raw, Reply reply) const {
  std::string id;
  try {
    const auto request = json::parse(raw); id = request.value("id", "");
    if (request.value("type", "") != "request" || id.empty() || !request.contains("method")) { reply(Error(id, "BRIDGE_INVALID_REQUEST", "Invalid bridge request").dump()); return; }
    const auto method = request.at("method").get<std::string>();
    if (method == "app.ping") { reply(Success(id, "pong").dump()); return; }
    if (method == "app.quit") { PostMessageW(owner_, WM_CLOSE, 0, 0); reply(Success(id, nullptr).dump()); return; }
    if (method == "app.getSettings") { reply(Success(id, LoadSettings()).dump()); return; }
    const auto params = request.value("params", json::object());
    if (method == "app.setSettings") { SaveSettings(params); reply(Success(id, nullptr).dump()); return; }
    if (method == "app.setDirty") {
      if (params.value("dirty", false)) SetPropW(owner_, kDirtyDocumentProperty, reinterpret_cast<HANDLE>(1));
      else RemovePropW(owner_, kDirtyDocumentProperty);
      reply(Success(id, nullptr).dump()); return;
    }
    if (method == "file.open") { const auto path = ChooseMarkdownFile(owner_); if (!path) { reply(Success(id, nullptr).dump()); return; } if (document_mapper_) document_mapper_(*path); reply(Success(id, {{"path", WideToUtf8(*path)}, {"name", WideToUtf8(std::filesystem::path(*path).filename().wstring())}, {"content", ReadUtf8File(*path)}}).dump()); return; }
    if (method == "file.read") {
      const auto path = Utf8ToWide(params.at("path").get<std::string>());
      if (document_mapper_) document_mapper_(path);
      reply(Success(id, {{"path", WideToUtf8(path)}, {"name", WideToUtf8(std::filesystem::path(path).filename().wstring())}, {"content", ReadUtf8File(path)}}).dump()); return;
    }
    if (method == "file.save" || method == "file.saveAs") {
      std::optional<std::wstring> path;
      if (method == "file.save") path = Utf8ToWide(params.at("path").get<std::string>());
      else path = ChooseMarkdownSavePath(owner_, Utf8ToWide(params.value("suggestedName", "Untitled.md")));
      if (!path) { reply(Success(id, nullptr).dump()); return; }
      WriteUtf8FileAtomically(*path, params.at("content").get<std::string>());
      if (document_mapper_) document_mapper_(*path);
      reply(Success(id, {{"path", WideToUtf8(*path)}, {"name", WideToUtf8(std::filesystem::path(*path).filename().wstring())}}).dump()); return;
    }
    if (method == "image.save") {
      const auto document_path = Utf8ToWide(params.at("documentPath").get<std::string>());
      if (document_mapper_) document_mapper_(document_path);
      const auto image = SaveImageData(
          document_path, params.at("mimeType").get<std::string>(),
          params.at("base64").get<std::string>());
      reply(Success(id, ImageJson(image)).dump());
      return;
    }
    if (method == "image.import") {
      const auto document_path = Utf8ToWide(params.at("documentPath").get<std::string>());
      if (document_mapper_) document_mapper_(document_path);
      std::vector<std::wstring> sources;
      for (const auto& source : params.at("sourcePaths")) {
        sources.push_back(Utf8ToWide(source.get<std::string>()));
      }
      const auto images = ImportImageFiles(document_path, sources);
      auto result = json::array();
      for (const auto& image : images) result.push_back(ImageJson(image));
      reply(Success(id, std::move(result)).dump());
      return;
    }
    if (method == "pdf.export") {
      const auto path = ChoosePdfSavePath(owner_, Utf8ToWide(params.value("suggestedName", "Untitled.pdf")));
      if (!path) { reply(Success(id, nullptr).dump()); return; }
      if (!pdf_exporter_) { reply(Error(id, "PDF_EXPORT_UNAVAILABLE", "PDF export is unavailable").dump()); return; }
      pdf_exporter_(*path, [id, path, reply](const HRESULT error, const bool success) {
        if (FAILED(error) || !success) { reply(Error(id, "PDF_EXPORT_FAILED", "PDF export failed").dump()); return; }
        reply(Success(id, {{"path", WideToUtf8(*path)}, {"name", WideToUtf8(std::filesystem::path(*path).filename().wstring())}}).dump());
      });
      return;
    }
    reply(Error(id, "BRIDGE_UNKNOWN_METHOD", "Unknown desktop method").dump());
  } catch (const std::exception& error) { reply(Error(id, "BRIDGE_OPERATION_FAILED", error.what()).dump()); }
}

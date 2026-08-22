#include "bridge/bridge_dispatcher.h"

#include "associations/file_association.h"
#include "common/app_state.h"
#include "common/utf8.h"
#include "dialogs/file_dialog.h"
#include "filesystem/file_service.h"
#include "images/image_service.h"
#include "recovery/recovery_service.h"
#include "settings/settings.h"

#include <Shellapi.h>

#include <algorithm>
#include <filesystem>
#include <nlohmann/json.hpp>
#include <optional>
#include <stdexcept>
#include <string>
#include <vector>

using json = nlohmann::json;

namespace {
namespace fs = std::filesystem;

constexpr char kRepositoryUrl[] = "https://github.com/lxw112190/lw.MD";
constexpr char kLatestReleaseUrl[] =
    "https://github.com/lxw112190/lw.MD/releases/latest";
constexpr std::size_t kMaxBridgeMessageBytes = 64U * 1024U * 1024U;
constexpr std::size_t kMaxMarkdownBytes = 16U * 1024U * 1024U;
constexpr std::size_t kMaxImageBase64Bytes = 48U * 1024U * 1024U;
constexpr std::size_t kMaxPathBytes = 32767U * 4U;
constexpr std::size_t kMaxImportedImages = 64U;

json Error(const std::string& id, const char* code, const char* message) {
  return {{"type", "response"},
          {"id", id},
          {"ok", false},
          {"error", {{"code", code}, {"message", message}}}};
}

json Success(const std::string& id, json result) {
  return {{"type", "response"},
          {"id", id},
          {"ok", true},
          {"result", std::move(result)}};
}

json ImageJson(const SavedImage& image) {
  return {{"path", WideToUtf8(image.absolute_path)},
          {"relativePath", WideToUtf8(image.relative_path)}};
}

std::string RequireString(const json& params, const char* name,
                          const std::size_t maximum_size,
                          const bool allow_empty = false) {
  if (!params.contains(name) || !params.at(name).is_string()) {
    throw std::invalid_argument(std::string("Invalid ") + name);
  }
  const auto value = params.at(name).get<std::string>();
  if ((!allow_empty && value.empty()) || value.size() > maximum_size) {
    throw std::invalid_argument(std::string("Invalid ") + name);
  }
  return value;
}

bool RequireBoolean(const json& params, const char* name) {
  if (!params.contains(name) || !params.at(name).is_boolean()) {
    throw std::invalid_argument(std::string("Invalid ") + name);
  }
  return params.at(name).get<bool>();
}

bool HasUnsafePathCharacters(const std::wstring& value) {
  return std::any_of(value.begin(), value.end(),
                     [](const wchar_t character) { return character < 32; });
}

bool HasExtension(const fs::path& path, const wchar_t* expected) {
  return _wcsicmp(path.extension().c_str(), expected) == 0;
}

bool IsAbsoluteMarkdownPath(const std::wstring& value) {
  const fs::path path(value);
  return !value.empty() && value.size() <= 32767U &&
         !HasUnsafePathCharacters(value) && path.is_absolute() &&
         path.has_filename() &&
         (HasExtension(path, L".md") || HasExtension(path, L".markdown"));
}

bool IsSimpleFileName(const std::wstring& value, const wchar_t* extension) {
  const fs::path path(value);
  return !value.empty() && value.size() <= 255U &&
         !HasUnsafePathCharacters(value) && !path.has_parent_path() &&
         path.has_filename() && path.filename() == path &&
         HasExtension(path, extension);
}

bool IsSimpleRecoveryName(const std::wstring& value) {
  const fs::path path(value);
  return !value.empty() && value.size() <= 255U && value != L"." &&
         value != L".." && !HasUnsafePathCharacters(value) &&
         !path.has_parent_path() && path.has_filename() &&
         path.filename() == path;
}

bool SamePath(const std::wstring& left, const std::wstring& right) {
  if (left.empty() || right.empty()) return false;
  const auto normalized_left = fs::path(left).lexically_normal().wstring();
  const auto normalized_right = fs::path(right).lexically_normal().wstring();
  return _wcsicmp(normalized_left.c_str(), normalized_right.c_str()) == 0;
}

bool IsRecentPath(const std::wstring& path) {
  const auto settings = LoadSettings();
  if (!settings.contains("recentFiles") ||
      !settings.at("recentFiles").is_array()) {
    return false;
  }
  for (const auto& item : settings.at("recentFiles")) {
    if (item.is_string() && SamePath(path, Utf8ToWide(item.get<std::string>()))) {
      return true;
    }
  }
  return false;
}

void ValidateReadableMarkdown(const std::wstring& path) {
  if (!IsAbsoluteMarkdownPath(path) || !fs::is_regular_file(path)) {
    throw std::invalid_argument("Invalid Markdown path");
  }
  std::error_code error;
  const auto size = fs::file_size(path, error);
  if (error || size > kMaxMarkdownBytes) {
    throw std::invalid_argument("Markdown file is too large");
  }
}

void ValidateSettingsUpdate(const json& params,
                            const std::wstring& current_document_path) {
  if (params.size() != 3U || !params.contains("theme") ||
      !params.at("theme").is_string() ||
      !params.contains("outlineVisible") ||
      !params.at("outlineVisible").is_boolean() ||
      !params.contains("recentFiles") ||
      !params.at("recentFiles").is_array() ||
      params.at("recentFiles").size() > 10U) {
    throw std::invalid_argument("Invalid settings");
  }
  const auto theme = params.at("theme").get<std::string>();
  if (theme != "system" && theme != "light" && theme != "dark") {
    throw std::invalid_argument("Invalid theme");
  }
  const auto existing = LoadSettings();
  for (const auto& item : params.at("recentFiles")) {
    if (!item.is_string() ||
        item.get_ref<const std::string&>().size() > kMaxPathBytes) {
      throw std::invalid_argument("Invalid recent file");
    }
    const auto path = Utf8ToWide(item.get<std::string>());
    if (!IsAbsoluteMarkdownPath(path)) {
      throw std::invalid_argument("Invalid recent file path");
    }
    bool allowed = SamePath(path, current_document_path);
    if (existing.contains("recentFiles") &&
        existing.at("recentFiles").is_array()) {
      for (const auto& previous : existing.at("recentFiles")) {
        if (previous.is_string() &&
            SamePath(path, Utf8ToWide(previous.get<std::string>()))) {
          allowed = true;
          break;
        }
      }
    }
    if (!allowed) throw std::invalid_argument("Recent file is not authorized");
  }
}

bool IsValidRecoverySnapshot(const RecoverySnapshot& snapshot) {
  try {
    const auto name = Utf8ToWide(snapshot.name);
    if (!IsSimpleRecoveryName(name) ||
        snapshot.content.size() > kMaxMarkdownBytes || snapshot.saved_at == 0) {
      return false;
    }
    return !snapshot.document_path ||
           (IsAbsoluteMarkdownPath(*snapshot.document_path) &&
            _wcsicmp(fs::path(*snapshot.document_path).filename().c_str(),
                     name.c_str()) == 0);
  } catch (...) {
    return false;
  }
}

json RecoveryJson(const RecoverySnapshot& snapshot) {
  return {{"path", snapshot.document_path
                       ? json(WideToUtf8(*snapshot.document_path))
                       : json(nullptr)},
          {"name", snapshot.name},
          {"content", snapshot.content},
          {"savedAt", snapshot.saved_at}};
}
}  // namespace

void BridgeDispatcher::SetCurrentDocumentPath(const std::wstring& path) {
  if (!path.empty() && !IsAbsoluteMarkdownPath(path)) {
    throw std::invalid_argument("Invalid current document path");
  }
  current_document_path_ =
      path.empty() ? L"" : fs::path(path).lexically_normal().wstring();
  pending_image_paths_.clear();
  if (document_mapper_) document_mapper_(current_document_path_);
}

void BridgeDispatcher::SetLaunchDocumentPath(const std::wstring& path) {
  ValidateReadableMarkdown(path);
  launch_document_path_ = fs::path(path).lexically_normal().wstring();
}

void BridgeDispatcher::SetPendingImagePaths(
    const std::vector<std::filesystem::path>& paths) {
  if (paths.empty() || paths.size() > kMaxImportedImages) {
    throw std::invalid_argument("Invalid dropped image count");
  }
  pending_image_paths_.clear();
  pending_image_paths_.reserve(paths.size());
  for (const auto& path : paths) {
    const auto value = path.lexically_normal().wstring();
    if (value.size() > 32767U || !path.is_absolute() ||
        !IsSupportedImagePath(value) || !fs::is_regular_file(path)) {
      pending_image_paths_.clear();
      throw std::invalid_argument("Invalid dropped image path");
    }
    pending_image_paths_.push_back(value);
  }
}

void BridgeDispatcher::Dispatch(const std::string& raw, Reply reply) {
  std::string id;
  try {
    if (raw.empty() || raw.size() > kMaxBridgeMessageBytes) {
      reply(Error(id, "BRIDGE_INVALID_REQUEST", "Bridge request is too large")
                .dump());
      return;
    }
    const auto request = json::parse(raw);
    if (!request.is_object() || !request.contains("id") ||
        !request.at("id").is_string() || !request.contains("method") ||
        !request.at("method").is_string() ||
        request.value("type", "") != "request") {
      reply(Error(id, "BRIDGE_INVALID_REQUEST", "Invalid bridge request").dump());
      return;
    }
    id = request.at("id").get<std::string>();
    const auto method = request.at("method").get<std::string>();
    if (id.empty() || id.size() > 128U || method.empty() ||
        method.size() > 64U) {
      reply(Error(id, "BRIDGE_INVALID_REQUEST", "Invalid bridge request").dump());
      return;
    }
    auto params =
        request.contains("params") ? request.at("params") : json::object();
    if (params.is_null()) params = json::object();
    if (!params.is_object()) {
      reply(Error(id, "BRIDGE_INVALID_PARAMS", "Invalid bridge parameters").dump());
      return;
    }

    if (method == "app.ping") {
      reply(Success(id, "pong").dump());
      return;
    }
    if (method == "app.quit") {
      PostMessageW(owner_, WM_CLOSE, 0, 0);
      reply(Success(id, nullptr).dump());
      return;
    }
    if (method == "app.setTitle") {
      const auto title = Utf8ToWide(RequireString(params, "title", 2048U));
      if (title.size() > 512U || HasUnsafePathCharacters(title)) {
        reply(Error(id, "INVALID_TITLE", "Invalid window title").dump());
        return;
      }
      SetWindowTextW(owner_, title.c_str());
      reply(Success(id, nullptr).dump());
      return;
    }
    if (method == "app.openExternal") {
      const auto url = RequireString(params, "url", 512U);
      if (url != kRepositoryUrl && url != kLatestReleaseUrl) {
        reply(Error(id, "EXTERNAL_URL_BLOCKED", "External URL is not allowed").dump());
        return;
      }
      const auto result = reinterpret_cast<INT_PTR>(ShellExecuteW(
          owner_, L"open", Utf8ToWide(url).c_str(), nullptr, nullptr,
          SW_SHOWNORMAL));
      if (result <= 32) {
        reply(Error(id, "EXTERNAL_OPEN_FAILED", "Cannot open the default browser")
                  .dump());
        return;
      }
      reply(Success(id, nullptr).dump());
      return;
    }
    if (method == "app.getSettings") {
      reply(Success(id, LoadSettings()).dump());
      return;
    }
    if (method == "app.setSettings") {
      ValidateSettingsUpdate(params, current_document_path_);
      SaveSettings(params);
      reply(Success(id, nullptr).dump());
      return;
    }
    if (method == "app.setDirty") {
      if (RequireBoolean(params, "dirty")) {
        SetPropW(owner_, kDirtyDocumentProperty, reinterpret_cast<HANDLE>(1));
      } else {
        RemovePropW(owner_, kDirtyDocumentProperty);
      }
      reply(Success(id, nullptr).dump());
      return;
    }
    if (method == "association.status") {
      if (!params.empty()) {
        reply(Error(id, "BRIDGE_INVALID_PARAMS",
                    "Invalid association parameters")
                  .dump());
        return;
      }
      const auto status = GetMarkdownFileAssociationStatus();
      reply(Success(id,
                    {{"registered", status.registered},
                     {"current", status.current},
                     {"executablePath", WideToUtf8(status.executable_path)},
                     {"registeredExecutablePath",
                      status.registered_executable_path.empty()
                          ? json(nullptr)
                          : json(WideToUtf8(
                                status.registered_executable_path))}})
                .dump());
      return;
    }
    if (method == "association.register" ||
        method == "association.unregister" ||
        method == "association.openDefaultApps") {
      if (!params.empty()) {
        reply(Error(id, "BRIDGE_INVALID_PARAMS",
                    "Invalid association parameters")
                  .dump());
        return;
      }
      if (method == "association.register") {
        RegisterMarkdownFileAssociations();
      } else if (method == "association.unregister") {
        UnregisterMarkdownFileAssociations();
      } else if (!OpenDefaultAppsSettings(owner_)) {
        reply(Error(id, "DEFAULT_APPS_OPEN_FAILED",
                    "Cannot open Windows default apps settings")
                  .dump());
        return;
      }
      reply(Success(id, nullptr).dump());
      return;
    }
    if (method == "recovery.get" || method == "recovery.restore") {
      if (!params.empty()) {
        reply(Error(id, "BRIDGE_INVALID_PARAMS", "Invalid recovery parameters")
                  .dump());
        return;
      }
      const auto snapshot = LoadRecoverySnapshot();
      if (!snapshot || !IsValidRecoverySnapshot(*snapshot)) {
        ClearRecoverySnapshot();
        if (method == "recovery.restore") {
          reply(Error(id, "RECOVERY_NOT_FOUND", "Recovery snapshot not found")
                    .dump());
        } else {
          reply(Success(id, nullptr).dump());
        }
        return;
      }
      if (method == "recovery.restore") {
        SetCurrentDocumentPath(snapshot->document_path
                                   ? *snapshot->document_path
                                   : std::wstring());
      }
      reply(Success(id, RecoveryJson(*snapshot)).dump());
      return;
    }
    if (method == "recovery.save") {
      if (params.size() != 3U || !params.contains("path") ||
          !params.contains("name") || !params.contains("content")) {
        reply(Error(id, "BRIDGE_INVALID_PARAMS", "Invalid recovery parameters")
                  .dump());
        return;
      }
      const auto name_utf8 = RequireString(params, "name", 1024U);
      const auto name = Utf8ToWide(name_utf8);
      const auto content =
          RequireString(params, "content", kMaxMarkdownBytes, true);
      if (!IsSimpleRecoveryName(name)) {
        reply(Error(id, "INVALID_FILE_NAME", "Invalid recovery file name")
                  .dump());
        return;
      }
      std::optional<std::wstring> path;
      if (params.at("path").is_string()) {
        path = Utf8ToWide(RequireString(params, "path", kMaxPathBytes));
        if (!SamePath(*path, current_document_path_) ||
            !IsAbsoluteMarkdownPath(*path) ||
            _wcsicmp(fs::path(*path).filename().c_str(), name.c_str()) != 0) {
          reply(Error(id, "RECOVERY_ACCESS_DENIED",
                      "Recovery path is not authorized")
                    .dump());
          return;
        }
      } else if (!params.at("path").is_null() ||
                 !current_document_path_.empty()) {
        reply(Error(id, "RECOVERY_ACCESS_DENIED",
                    "Recovery path is not authorized")
                  .dump());
        return;
      }
      SaveRecoverySnapshot(RecoverySnapshot{path, name_utf8, content, 0});
      reply(Success(id, nullptr).dump());
      return;
    }
    if (method == "recovery.clear") {
      if (!params.empty()) {
        reply(Error(id, "BRIDGE_INVALID_PARAMS", "Invalid recovery parameters")
                  .dump());
        return;
      }
      ClearRecoverySnapshot();
      reply(Success(id, nullptr).dump());
      return;
    }
    if (method == "file.getLaunch") {
      if (!params.empty()) {
        reply(Error(id, "BRIDGE_INVALID_PARAMS", "Invalid launch parameters")
                  .dump());
        return;
      }
      if (launch_document_path_.empty()) {
        reply(Success(id, nullptr).dump());
        return;
      }
      ValidateReadableMarkdown(launch_document_path_);
      const auto path = launch_document_path_;
      const auto content = ReadUtf8File(path);
      launch_document_path_.clear();
      SetCurrentDocumentPath(path);
      reply(Success(id,
                    {{"path", WideToUtf8(path)},
                     {"name", WideToUtf8(fs::path(path).filename().wstring())},
                     {"content", std::move(content)}})
                .dump());
      return;
    }
    if (method == "file.clearCurrent") {
      SetCurrentDocumentPath(L"");
      reply(Success(id, nullptr).dump());
      return;
    }
    if (method == "file.open") {
      const auto path = ChooseMarkdownFile(owner_);
      if (!path) {
        reply(Success(id, nullptr).dump());
        return;
      }
      ValidateReadableMarkdown(*path);
      SetCurrentDocumentPath(*path);
      reply(Success(id,
                    {{"path", WideToUtf8(*path)},
                     {"name", WideToUtf8(fs::path(*path).filename().wstring())},
                     {"content", ReadUtf8File(*path)}})
                .dump());
      return;
    }
    if (method == "file.read") {
      const auto path =
          Utf8ToWide(RequireString(params, "path", kMaxPathBytes));
      ValidateReadableMarkdown(path);
      if (!SamePath(path, current_document_path_) && !IsRecentPath(path)) {
        reply(Error(id, "FILE_ACCESS_DENIED", "Markdown path is not authorized")
                  .dump());
        return;
      }
      SetCurrentDocumentPath(path);
      reply(Success(id,
                    {{"path", WideToUtf8(path)},
                     {"name", WideToUtf8(fs::path(path).filename().wstring())},
                     {"content", ReadUtf8File(path)}})
                .dump());
      return;
    }
    if (method == "file.save" || method == "file.saveAs") {
      const auto content =
          RequireString(params, "content", kMaxMarkdownBytes, true);
      std::optional<std::wstring> path;
      if (method == "file.save") {
        const auto requested =
            Utf8ToWide(RequireString(params, "path", kMaxPathBytes));
        if (!IsAbsoluteMarkdownPath(requested) ||
            !SamePath(requested, current_document_path_)) {
          reply(Error(id, "FILE_ACCESS_DENIED", "Markdown path is not authorized")
                    .dump());
          return;
        }
        path = requested;
      } else {
        const auto suggested =
            Utf8ToWide(RequireString(params, "suggestedName", 1020U));
        if (!IsSimpleFileName(suggested, L".md") &&
            !IsSimpleFileName(suggested, L".markdown")) {
          reply(Error(id, "INVALID_FILE_NAME", "Invalid Markdown file name")
                    .dump());
          return;
        }
        path = ChooseMarkdownSavePath(owner_, suggested);
      }
      if (!path) {
        reply(Success(id, nullptr).dump());
        return;
      }
      if (!IsAbsoluteMarkdownPath(*path)) {
        reply(Error(id, "INVALID_FILE_PATH", "Invalid Markdown file path").dump());
        return;
      }
      WriteUtf8FileAtomically(*path, content);
      SetCurrentDocumentPath(*path);
      reply(Success(id,
                    {{"path", WideToUtf8(*path)},
                     {"name", WideToUtf8(fs::path(*path).filename().wstring())}})
                .dump());
      return;
    }
    if (method == "image.save") {
      const auto document_path =
          Utf8ToWide(RequireString(params, "documentPath", kMaxPathBytes));
      if (!SamePath(document_path, current_document_path_)) {
        reply(Error(id, "FILE_ACCESS_DENIED", "Document path is not authorized")
                  .dump());
        return;
      }
      const auto image = SaveImageData(
          document_path, RequireString(params, "mimeType", 64U),
          RequireString(params, "base64", kMaxImageBase64Bytes));
      reply(Success(id, ImageJson(image)).dump());
      return;
    }
    if (method == "image.import") {
      const auto document_path =
          Utf8ToWide(RequireString(params, "documentPath", kMaxPathBytes));
      if (!SamePath(document_path, current_document_path_) ||
          !params.contains("sourcePaths") ||
          !params.at("sourcePaths").is_array() ||
          params.at("sourcePaths").empty() ||
          params.at("sourcePaths").size() > kMaxImportedImages) {
        reply(Error(id, "IMAGE_IMPORT_DENIED", "Image import is not authorized")
                  .dump());
        return;
      }
      std::vector<std::wstring> sources;
      for (const auto& source : params.at("sourcePaths")) {
        if (!source.is_string() ||
            source.get_ref<const std::string&>().size() > kMaxPathBytes) {
          throw std::invalid_argument("Invalid image source path");
        }
        const auto path = fs::path(Utf8ToWide(source.get<std::string>()))
                              .lexically_normal()
                              .wstring();
        const bool authorized = std::any_of(
            pending_image_paths_.begin(), pending_image_paths_.end(),
            [&path](const auto& allowed) { return SamePath(path, allowed); });
        if (!authorized || !IsSupportedImagePath(path) ||
            !fs::is_regular_file(path)) {
          reply(Error(id, "IMAGE_IMPORT_DENIED", "Image import is not authorized")
                    .dump());
          return;
        }
        sources.push_back(path);
      }
      pending_image_paths_.clear();
      const auto images = ImportImageFiles(document_path, sources);
      auto result = json::array();
      for (const auto& image : images) result.push_back(ImageJson(image));
      reply(Success(id, std::move(result)).dump());
      return;
    }
    if (method == "pdf.export") {
      const auto suggested =
          Utf8ToWide(RequireString(params, "suggestedName", 1020U));
      if (!IsSimpleFileName(suggested, L".pdf")) {
        reply(Error(id, "INVALID_FILE_NAME", "Invalid PDF file name").dump());
        return;
      }
      const auto path = ChoosePdfSavePath(owner_, suggested);
      if (!path) {
        reply(Success(id, nullptr).dump());
        return;
      }
      if (!pdf_exporter_) {
        reply(Error(id, "PDF_EXPORT_UNAVAILABLE", "PDF export is unavailable")
                  .dump());
        return;
      }
      pdf_exporter_(*path, [id, path, reply](const HRESULT error,
                                             const bool success) {
        if (FAILED(error) || !success) {
          reply(Error(id, "PDF_EXPORT_FAILED", "PDF export failed").dump());
          return;
        }
        reply(Success(
                  id, {{"path", WideToUtf8(*path)},
                       {"name", WideToUtf8(fs::path(*path).filename().wstring())}})
                  .dump());
      });
      return;
    }
    reply(Error(id, "BRIDGE_UNKNOWN_METHOD", "Unknown desktop method").dump());
  } catch (const std::exception& error) {
    reply(Error(id, "BRIDGE_OPERATION_FAILED", error.what()).dump());
  }
}

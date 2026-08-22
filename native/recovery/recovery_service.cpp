#include "recovery/recovery_service.h"

#include "common/utf8.h"
#include "filesystem/file_service.h"

#include <ShlObj.h>

#include <chrono>
#include <filesystem>
#include <nlohmann/json.hpp>
#include <stdexcept>

using json = nlohmann::json;

namespace {
constexpr std::uintmax_t kMaxSnapshotBytes = 64U * 1024U * 1024U;
constexpr std::size_t kMaxMarkdownBytes = 16U * 1024U * 1024U;
constexpr std::size_t kMaxNameBytes = 1024U;
constexpr std::size_t kMaxPathBytes = 32767U * 4U;

std::uint64_t CurrentTimeMilliseconds() {
  return static_cast<std::uint64_t>(
      std::chrono::duration_cast<std::chrono::milliseconds>(
          std::chrono::system_clock::now().time_since_epoch())
          .count());
}

RecoverySnapshot ParseSnapshot(const json& value) {
  if (!value.is_object() || value.value("version", 0) != 1 ||
      !value.contains("path") || !value.contains("name") ||
      !value.at("name").is_string() || !value.contains("content") ||
      !value.at("content").is_string() || !value.contains("savedAt") ||
      !value.at("savedAt").is_number_unsigned()) {
    throw std::runtime_error("Invalid recovery snapshot");
  }
  RecoverySnapshot snapshot;
  snapshot.name = value.at("name").get<std::string>();
  snapshot.content = value.at("content").get<std::string>();
  snapshot.saved_at = value.at("savedAt").get<std::uint64_t>();
  if (snapshot.name.empty() || snapshot.name.size() > kMaxNameBytes ||
      snapshot.content.size() > kMaxMarkdownBytes || snapshot.saved_at == 0) {
    throw std::runtime_error("Invalid recovery snapshot");
  }
  if (value.at("path").is_string()) {
    const auto path = value.at("path").get<std::string>();
    if (path.empty() || path.size() > kMaxPathBytes) {
      throw std::runtime_error("Invalid recovery snapshot path");
    }
    snapshot.document_path = Utf8ToWide(path);
  } else if (!value.at("path").is_null()) {
    throw std::runtime_error("Invalid recovery snapshot path");
  }
  return snapshot;
}
}  // namespace

std::filesystem::path RecoverySnapshotPath() {
  PWSTR local_app_data = nullptr;
  if (FAILED(SHGetKnownFolderPath(FOLDERID_LocalAppData, KF_FLAG_CREATE,
                                  nullptr, &local_app_data))) {
    throw std::runtime_error("Cannot locate local application data");
  }
  const std::filesystem::path root(local_app_data);
  CoTaskMemFree(local_app_data);
  return root / L"lw.MD" / L"recovery" / L"current.json";
}

std::optional<RecoverySnapshot> LoadRecoverySnapshot() {
  const auto path = RecoverySnapshotPath();
  try {
    return LoadRecoverySnapshotFrom(path);
  } catch (...) {
    ClearRecoverySnapshotAt(path);
    return std::nullopt;
  }
}

void SaveRecoverySnapshot(const RecoverySnapshot& snapshot) {
  SaveRecoverySnapshotTo(RecoverySnapshotPath(), snapshot);
}

void ClearRecoverySnapshot() {
  ClearRecoverySnapshotAt(RecoverySnapshotPath());
}

std::optional<RecoverySnapshot> LoadRecoverySnapshotFrom(
    const std::filesystem::path& path) {
  if (!std::filesystem::exists(path)) return std::nullopt;
  std::error_code error;
  const auto size = std::filesystem::file_size(path, error);
  if (error || size == 0 || size > kMaxSnapshotBytes) {
    throw std::runtime_error("Invalid recovery snapshot size");
  }
  return ParseSnapshot(json::parse(ReadUtf8File(path.wstring())));
}

void SaveRecoverySnapshotTo(const std::filesystem::path& path,
                            const RecoverySnapshot& snapshot) {
  if (path.empty() || !path.has_parent_path() || snapshot.name.empty() ||
      snapshot.name.size() > kMaxNameBytes ||
      snapshot.content.size() > kMaxMarkdownBytes) {
    throw std::runtime_error("Invalid recovery snapshot");
  }
  std::filesystem::create_directories(path.parent_path());
  const auto saved_at =
      snapshot.saved_at == 0 ? CurrentTimeMilliseconds() : snapshot.saved_at;
  json value = {{"version", 1},
                {"path", snapshot.document_path
                             ? json(WideToUtf8(*snapshot.document_path))
                             : json(nullptr)},
                {"name", snapshot.name},
                {"content", snapshot.content},
                {"savedAt", saved_at}};
  WriteUtf8FileAtomically(path.wstring(), value.dump());
}

void ClearRecoverySnapshotAt(const std::filesystem::path& path) {
  std::error_code ignored;
  std::filesystem::remove(path, ignored);
  std::filesystem::remove(path.wstring() + L".lw-md.tmp", ignored);
}

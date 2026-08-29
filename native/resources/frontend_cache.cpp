#include "resources/frontend_cache.h"

#include <algorithm>
#include <chrono>
#include <string>
#include <vector>

namespace {
constexpr std::size_t kRetainedPreviousVersions = 2;
constexpr auto kMinimumCacheAge = std::chrono::hours(48);

struct CacheVersion {
  std::filesystem::path path;
  std::filesystem::file_time_type modified;
};

bool IsPayloadHash(const std::wstring& name) {
  if (name.size() != 16) return false;
  return std::all_of(name.begin(), name.end(), [](wchar_t value) {
    return (value >= L'0' && value <= L'9') ||
           (value >= L'a' && value <= L'f');
  });
}
}  // namespace

void CleanupStaleFrontendCaches(
    const std::filesystem::path& cache_root,
    const std::filesystem::path& current,
    std::filesystem::file_time_type now) noexcept {
  try {
    std::error_code error;
    std::vector<CacheVersion> versions;
    for (std::filesystem::directory_iterator iterator(cache_root, error), end;
         !error && iterator != end; iterator.increment(error)) {
      std::error_code entry_error;
      if (!iterator->is_directory(entry_error) || entry_error ||
          !IsPayloadHash(iterator->path().filename().wstring())) {
        continue;
      }
      const auto modified = iterator->last_write_time(entry_error);
      if (!entry_error) versions.push_back({iterator->path(), modified});
    }
    if (error) return;

    std::sort(versions.begin(), versions.end(),
              [](const auto& left, const auto& right) {
                return left.modified > right.modified;
              });

    const auto normalized_current = current.lexically_normal();
    std::size_t retained_previous_versions = 0;
    for (const auto& version : versions) {
      if (version.path.lexically_normal() == normalized_current) continue;
      if (retained_previous_versions++ < kRetainedPreviousVersions) continue;
      if (version.modified < now - kMinimumCacheAge) {
        std::filesystem::remove_all(version.path, error);
        error.clear();
      }
    }
  } catch (...) {
    // Cleanup is best-effort and must never affect application startup.
  }
}

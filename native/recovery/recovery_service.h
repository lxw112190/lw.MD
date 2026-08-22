#pragma once

#include <cstdint>
#include <filesystem>
#include <optional>
#include <string>

struct RecoverySnapshot {
  std::optional<std::wstring> document_path;
  std::string name;
  std::string content;
  std::uint64_t saved_at = 0;
};

std::filesystem::path RecoverySnapshotPath();
std::optional<RecoverySnapshot> LoadRecoverySnapshot();
void SaveRecoverySnapshot(const RecoverySnapshot& snapshot);
void ClearRecoverySnapshot();

std::optional<RecoverySnapshot> LoadRecoverySnapshotFrom(
    const std::filesystem::path& path);
void SaveRecoverySnapshotTo(const std::filesystem::path& path,
                            const RecoverySnapshot& snapshot);
void ClearRecoverySnapshotAt(const std::filesystem::path& path);

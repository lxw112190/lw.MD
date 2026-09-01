#pragma once

#include <array>
#include <cstdint>
#include <string>

struct FileRevision {
  std::uint64_t size = 0;
  std::uint64_t last_write_time = 0;
  std::array<std::uint8_t, 32> sha256{};
};

FileRevision GetFileRevision(const std::wstring& path);
void FillFileRevisionFromContent(const std::wstring& path,
                                 const std::string& content,
                                 FileRevision& revision);
bool SameFileContent(const FileRevision& left, const FileRevision& right);
std::string FileRevisionHashHex(const FileRevision& revision);

#include "filesystem/file_service.h"
#include <Windows.h>
#include <filesystem>
#include <fstream>
#include <stdexcept>

std::string ReadUtf8File(const std::wstring& path) {
  std::ifstream input(std::filesystem::path(path), std::ios::binary);
  if (!input) throw std::runtime_error("Unable to read file");
  return {std::istreambuf_iterator<char>(input), std::istreambuf_iterator<char>()};
}
FileReadResult ReadUtf8FileWithRevision(const std::wstring& path) {
  std::ifstream input(std::filesystem::path(path), std::ios::binary);
  if (!input) throw std::runtime_error("Unable to read file");
  std::string content{std::istreambuf_iterator<char>(input),
                      std::istreambuf_iterator<char>()};
  FileRevision revision{};
  FillFileRevisionFromContent(path, content, revision);
  FileReadResult result;
  result.content = std::move(content);
  result.revision = revision;
  return result;
}
void WriteUtf8FileAtomically(const std::wstring& path, const std::string& content) {
  const std::filesystem::path target(path);
  if (target.empty() || !target.has_parent_path()) throw std::runtime_error("Invalid file path");
  const auto temporary = target.parent_path() / (target.filename().wstring() + L".lw-md.tmp");
  {
    std::ofstream output(temporary, std::ios::binary | std::ios::trunc);
    if (!output) throw std::runtime_error("Unable to create temporary file");
    output.write(content.data(), static_cast<std::streamsize>(content.size()));
    output.flush();
    if (!output) {
      std::filesystem::remove(temporary);
      throw std::runtime_error("Unable to write temporary file");
    }
  }

  const auto original_attributes = GetFileAttributesW(target.c_str());
  const bool target_exists = original_attributes != INVALID_FILE_ATTRIBUTES;
  const DWORD blocking_attributes =
      FILE_ATTRIBUTE_READONLY | FILE_ATTRIBUTE_HIDDEN;
  const bool target_needs_unlock =
      target_exists && (original_attributes & blocking_attributes) != 0;
  if (target_needs_unlock &&
      !SetFileAttributesW(target.c_str(),
                          original_attributes & ~blocking_attributes)) {
    std::filesystem::remove(temporary);
    throw std::runtime_error("Unable to unlock the read-only original file");
  }

  if (!MoveFileExW(temporary.c_str(), target.c_str(),
                   MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH)) {
    const auto error = GetLastError();
    if (target_needs_unlock) {
      SetFileAttributesW(target.c_str(), original_attributes);
    }
    std::filesystem::remove(temporary);
    throw std::runtime_error("Unable to replace original file (Windows error " +
                             std::to_string(error) + ")");
  }

  if (target_exists) {
    SetFileAttributesW(target.c_str(), original_attributes);
  }
}

FileRevision SaveUtf8FileChecked(const std::wstring& path,
                                 const std::string& content,
                                 const FileRevision& expected_revision) {
  std::error_code error;
  if (!std::filesystem::is_regular_file(path, error) || error) {
    throw std::runtime_error("FILE_MISSING");
  }
  const auto current = GetFileRevision(path);
  if (!SameFileContent(current, expected_revision)) {
    throw std::runtime_error("FILE_CONFLICT");
  }
  WriteUtf8FileAtomically(path, content);
  return GetFileRevision(path);
}

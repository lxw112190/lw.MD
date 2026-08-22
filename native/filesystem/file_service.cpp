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
void WriteUtf8FileAtomically(const std::wstring& path, const std::string& content) {
  const std::filesystem::path target(path);
  if (target.empty() || !target.has_parent_path()) throw std::runtime_error("Invalid file path");
  const auto temporary = target.parent_path() / (target.filename().wstring() + L".lw-md.tmp");
  { std::ofstream output(temporary, std::ios::binary | std::ios::trunc); if (!output) throw std::runtime_error("Unable to create temporary file"); output.write(content.data(), static_cast<std::streamsize>(content.size())); output.flush(); if (!output) { std::filesystem::remove(temporary); throw std::runtime_error("Unable to write temporary file"); } }
  if (!MoveFileExW(temporary.c_str(), target.c_str(), MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH)) { std::filesystem::remove(temporary); throw std::runtime_error("Unable to replace original file"); }
}

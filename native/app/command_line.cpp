#include "app/command_line.h"

#include <Windows.h>

#include <cstdint>
#include <filesystem>
#include <system_error>

namespace {
constexpr std::uintmax_t kMaxMarkdownBytes = 16U * 1024U * 1024U;

bool IsMarkdownExtension(const std::filesystem::path& path) {
  const auto extension = path.extension().wstring();
  return _wcsicmp(extension.c_str(), L".md") == 0 ||
         _wcsicmp(extension.c_str(), L".markdown") == 0;
}
}  // namespace

std::optional<std::wstring> ResolveLaunchMarkdownPath(
    const std::wstring& argument) {
  if (argument.empty() || argument.size() > 32767U) return std::nullopt;

  std::error_code error;
  auto path = std::filesystem::path(argument);
  if (!path.is_absolute()) path = std::filesystem::absolute(path, error);
  if (error || !IsMarkdownExtension(path) ||
      !std::filesystem::is_regular_file(path, error) || error) {
    return std::nullopt;
  }
  const auto size = std::filesystem::file_size(path, error);
  if (error || size > kMaxMarkdownBytes) return std::nullopt;
  return path.lexically_normal().wstring();
}

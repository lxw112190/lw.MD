#include "filesystem/file_service.h"
#include "images/image_service.h"

#include <Windows.h>
#include <filesystem>
#include <iostream>

int main() {
  wchar_t temporary_root[MAX_PATH]{};
  if (!GetTempPathW(MAX_PATH, temporary_root)) return 1;
  const auto directory = std::filesystem::path(temporary_root) / L"lw-md-native-tests";
  std::filesystem::create_directories(directory);
  const auto file = directory / L"中文-atomic.md";
  const std::string first = "# 简墨\n第一版";
  const std::string second = "# 简墨\n第二版 ✓";
  WriteUtf8FileAtomically(file.wstring(), first);
  if (ReadUtf8File(file.wstring()) != first) return 2;
  WriteUtf8FileAtomically(file.wstring(), second);
  if (ReadUtf8File(file.wstring()) != second) return 3;
  if (std::filesystem::exists(file.wstring() + L".lw-md.tmp")) return 4;
  const auto image = SaveImageData(
      file.wstring(), "image/png",
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=");
  if (!std::filesystem::exists(image.absolute_path)) return 5;
  if (image.relative_path.rfind(L"./assets/", 0) != 0) return 6;
  const auto source = directory / L"测试 图片.png";
  std::filesystem::copy_file(image.absolute_path, source);
  const auto imported = ImportImageFiles(file.wstring(), {source.wstring(), source.wstring()});
  if (imported.size() != 2 || imported[0].relative_path == imported[1].relative_path) return 7;
  if (!IsSupportedImagePath(L"示例.JPEG") || IsSupportedImagePath(L"示例.txt")) return 8;
  std::filesystem::remove_all(directory / L"assets");
  std::filesystem::remove(source);
  std::filesystem::remove(file);
  std::filesystem::remove(directory);
  std::cout << "native file tests passed\n";
  return 0;
}

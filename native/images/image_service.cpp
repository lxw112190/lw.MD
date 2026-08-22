#include "images/image_service.h"

#include <Windows.h>
#include <Wincrypt.h>

#include <algorithm>
#include <array>
#include <chrono>
#include <filesystem>
#include <fstream>
#include <iomanip>
#include <sstream>
#include <stdexcept>
#include <unordered_map>

namespace {
namespace fs = std::filesystem;

const std::unordered_map<std::string, std::wstring> kMimeExtensions = {
    {"image/png", L".png"},   {"image/jpeg", L".jpg"}, {"image/gif", L".gif"},
    {"image/webp", L".webp"}, {"image/bmp", L".bmp"},  {"image/svg+xml", L".svg"}};

const std::array<const wchar_t*, 7> kImageExtensions = {
    L".png", L".jpg", L".jpeg", L".gif", L".webp", L".bmp", L".svg"};

fs::path AssetsDirectory(const std::wstring& document_path) {
  const fs::path document(document_path);
  if (document.empty() || !document.has_parent_path() || !document.has_filename()) {
    throw std::runtime_error("Please save the Markdown document before inserting images");
  }
  const auto extension = document.extension().wstring();
  if (_wcsicmp(extension.c_str(), L".md") != 0 &&
      _wcsicmp(extension.c_str(), L".markdown") != 0) {
    throw std::runtime_error("Invalid Markdown document path");
  }
  const auto assets = document.parent_path() / L"assets";
  fs::create_directories(assets);
  return assets;
}

fs::path UniquePath(const fs::path& directory, const std::wstring& stem,
                    const std::wstring& extension) {
  auto candidate = directory / (stem + extension);
  for (unsigned int suffix = 1; fs::exists(candidate); ++suffix) {
    candidate = directory / (stem + L"-" + std::to_wstring(suffix) + extension);
  }
  return candidate;
}

std::wstring RelativeMarkdownPath(const fs::path& image) {
  return L"./assets/" + image.filename().generic_wstring();
}

std::wstring TimestampName() {
  SYSTEMTIME time{};
  GetLocalTime(&time);
  std::wostringstream output;
  output << std::setfill(L'0') << std::setw(4) << time.wYear << std::setw(2) << time.wMonth
         << std::setw(2) << time.wDay << L"-" << std::setw(2) << time.wHour << std::setw(2)
         << time.wMinute << std::setw(2) << time.wSecond;
  return output.str();
}

std::wstring SafeStem(std::wstring stem) {
  constexpr wchar_t kInvalid[] = L"<>:\"/\\|?*";
  for (auto& character : stem) {
    if (character < 32 || std::wcschr(kInvalid, character)) character = L'_';
  }
  while (!stem.empty() && (stem.back() == L'.' || stem.back() == L' ')) stem.pop_back();
  return stem.empty() ? L"image" : stem;
}

std::vector<unsigned char> DecodeBase64(const std::string& input) {
  if (input.empty() || input.size() > 48U * 1024U * 1024U) {
    throw std::runtime_error("Image data is empty or too large");
  }
  DWORD size = 0;
  if (!CryptStringToBinaryA(input.c_str(), static_cast<DWORD>(input.size()),
                            CRYPT_STRING_BASE64, nullptr, &size, nullptr, nullptr)) {
    throw std::runtime_error("Invalid image data");
  }
  std::vector<unsigned char> bytes(size);
  if (!CryptStringToBinaryA(input.c_str(), static_cast<DWORD>(input.size()),
                            CRYPT_STRING_BASE64, bytes.data(), &size, nullptr, nullptr)) {
    throw std::runtime_error("Cannot decode image data");
  }
  bytes.resize(size);
  return bytes;
}

void WriteBinaryFile(const fs::path& destination, const std::vector<unsigned char>& bytes) {
  const auto temporary = destination.wstring() + L".lw-md.tmp";
  {
    std::ofstream output(fs::path(temporary), std::ios::binary | std::ios::trunc);
    if (!output) throw std::runtime_error("Cannot create image file");
    output.write(reinterpret_cast<const char*>(bytes.data()),
                 static_cast<std::streamsize>(bytes.size()));
    output.flush();
    if (!output) {
      fs::remove(temporary);
      throw std::runtime_error("Cannot write image file");
    }
  }
  if (!MoveFileExW(temporary.c_str(), destination.c_str(),
                   MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH)) {
    fs::remove(temporary);
    throw std::runtime_error("Cannot publish image file");
  }
}
}  // namespace

bool IsSupportedImagePath(const std::wstring& path) {
  auto extension = std::filesystem::path(path).extension().wstring();
  std::transform(extension.begin(), extension.end(), extension.begin(), towlower);
  return std::any_of(kImageExtensions.begin(), kImageExtensions.end(),
                     [&extension](const wchar_t* allowed) { return extension == allowed; });
}

SavedImage SaveImageData(const std::wstring& document_path, const std::string& mime_type,
                         const std::string& base64_data) {
  const auto extension = kMimeExtensions.find(mime_type);
  if (extension == kMimeExtensions.end()) throw std::runtime_error("Unsupported image type");
  const auto destination = UniquePath(AssetsDirectory(document_path), TimestampName(),
                                      extension->second);
  WriteBinaryFile(destination, DecodeBase64(base64_data));
  return {destination.wstring(), RelativeMarkdownPath(destination)};
}

std::vector<SavedImage> ImportImageFiles(const std::wstring& document_path,
                                         const std::vector<std::wstring>& source_paths) {
  const auto assets = AssetsDirectory(document_path);
  std::vector<SavedImage> saved;
  saved.reserve(source_paths.size());
  for (const auto& source_string : source_paths) {
    const fs::path source(source_string);
    if (!IsSupportedImagePath(source.wstring()) || !fs::is_regular_file(source)) {
      throw std::runtime_error("Unsupported or missing image file");
    }
    auto extension = source.extension().wstring();
    std::transform(extension.begin(), extension.end(), extension.begin(), towlower);
    const auto destination = UniquePath(assets, SafeStem(source.stem().wstring()), extension);
    if (!CopyFileW(source.c_str(), destination.c_str(), TRUE)) {
      throw std::runtime_error("Cannot copy image into assets directory");
    }
    saved.push_back({destination.wstring(), RelativeMarkdownPath(destination)});
  }
  return saved;
}

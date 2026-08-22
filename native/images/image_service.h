#pragma once

#include <string>
#include <vector>

struct SavedImage {
  std::wstring absolute_path;
  std::wstring relative_path;
};

SavedImage SaveImageData(const std::wstring& document_path, const std::string& mime_type,
                         const std::string& base64_data);
std::vector<SavedImage> ImportImageFiles(const std::wstring& document_path,
                                         const std::vector<std::wstring>& source_paths);
bool IsSupportedImagePath(const std::wstring& path);

#pragma once
#include <string>
std::string ReadUtf8File(const std::wstring& path);
void WriteUtf8FileAtomically(const std::wstring& path, const std::string& content);

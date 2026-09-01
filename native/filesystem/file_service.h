#pragma once
#include "filesystem/file_revision.h"
#include <string>
std::string ReadUtf8File(const std::wstring& path);
void WriteUtf8FileAtomically(const std::wstring& path, const std::string& content);
FileRevision SaveUtf8FileChecked(const std::wstring& path,
                                 const std::string& content,
                                 const FileRevision& expected_revision);

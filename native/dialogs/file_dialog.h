#pragma once
#include <Windows.h>
#include <optional>
#include <string>

std::optional<std::wstring> ChooseMarkdownFile(HWND owner);
std::optional<std::wstring> ChooseMarkdownSavePath(HWND owner, const std::wstring& suggested_name);
std::optional<std::wstring> ChoosePdfSavePath(HWND owner, const std::wstring& suggested_name);

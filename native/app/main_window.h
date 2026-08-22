#pragma once
#include <Windows.h>
#include <optional>
#include <string>

int RunMainWindow(HINSTANCE instance,
                  const std::optional<std::wstring>& launch_path = std::nullopt);

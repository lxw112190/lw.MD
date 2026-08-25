#pragma once

#include <Windows.h>
#include <Shellapi.h>
#include <oleidl.h>
#include <wrl/client.h>

#include <filesystem>
#include <functional>
#include <vector>

using FileDropHandler =
    std::function<void(const std::vector<std::filesystem::path>&)>;
using FileDragStateHandler = std::function<void(bool)>;

Microsoft::WRL::ComPtr<IDropTarget> CreateFileDropTarget(
    FileDropHandler handler, FileDragStateHandler state_handler);

std::vector<std::filesystem::path> ExtractDroppedFilePaths(HDROP drop);

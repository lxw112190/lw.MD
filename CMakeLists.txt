cmake_minimum_required(VERSION 3.22)
project(lw_MD VERSION 0.4.3 LANGUAGES CXX)

if(NOT WIN32 OR NOT CMAKE_SIZEOF_VOID_P EQUAL 8)
  message(FATAL_ERROR "lw.MD supports Windows x64 only")
endif()
if(POLICY CMP0135)
  cmake_policy(SET CMP0135 NEW)
endif()
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
set(CMAKE_MSVC_RUNTIME_LIBRARY "MultiThreaded$<$<CONFIG:Debug>:Debug>")
set(LWMD_MANIFEST "${CMAKE_CURRENT_SOURCE_DIR}/resources/lw-md.manifest")

include(FetchContent)
FetchContent_Declare(nlohmann_json URL https://github.com/nlohmann/json/releases/download/v3.12.0/json.tar.xz URL_HASH SHA256=42f6e95cad6ec532fd372391373363b62a14af6d771056dbfc86160e6dfff7aa)
FetchContent_MakeAvailable(nlohmann_json)
if(EXISTS "${CMAKE_CURRENT_SOURCE_DIR}/.deps/miniz.tar.gz")
  set(LWMD_MINIZ_URL "${CMAKE_CURRENT_SOURCE_DIR}/.deps/miniz.tar.gz")
else()
  set(LWMD_MINIZ_URL "https://github.com/richgel999/miniz/archive/refs/tags/3.1.0.tar.gz")
endif()
FetchContent_Declare(miniz
  URL "${LWMD_MINIZ_URL}"
  URL_HASH SHA256=09569fc19d060ac9f5999ba9356728c2494ebe6a24ac0eb0a6b6ae3d396cfea6)
FetchContent_MakeAvailable(miniz)
set(WEBVIEW2_VERSION "1.0.4078.44" CACHE STRING "WebView2 SDK version")
FetchContent_Declare(webview2_sdk URL "https://www.nuget.org/api/v2/package/Microsoft.Web.WebView2/${WEBVIEW2_VERSION}" DOWNLOAD_NAME webview2.zip SOURCE_SUBDIR _no_cmake)
FetchContent_MakeAvailable(webview2_sdk)
set(WEBVIEW2_ROOT "${webview2_sdk_SOURCE_DIR}")
set(WEBVIEW2_INCLUDE "${WEBVIEW2_ROOT}/build/native/include")
set(WEBVIEW2_LOADER "${WEBVIEW2_ROOT}/build/native/x64/WebView2LoaderStatic.lib")
if(NOT EXISTS "${WEBVIEW2_INCLUDE}/WebView2.h" OR NOT EXISTS "${WEBVIEW2_LOADER}")
  message(FATAL_ERROR "Unexpected WebView2 SDK layout")
endif()

find_program(NPM_EXECUTABLE NAMES npm.cmd npm REQUIRED)
set(LWMD_GENERATED_DIR "${CMAKE_CURRENT_BINARY_DIR}/generated")
set(LWMD_FRONTEND_ZIP "${LWMD_GENERATED_DIR}/frontend.zip")
file(GLOB_RECURSE LWMD_FRONTEND_INPUTS CONFIGURE_DEPENDS
  "${CMAKE_CURRENT_SOURCE_DIR}/app/src/*"
  "${CMAKE_CURRENT_SOURCE_DIR}/app/public/*")
list(APPEND LWMD_FRONTEND_INPUTS
  "${CMAKE_CURRENT_SOURCE_DIR}/app/index.html"
  "${CMAKE_CURRENT_SOURCE_DIR}/app/package.json"
  "${CMAKE_CURRENT_SOURCE_DIR}/app/package-lock.json"
  "${CMAKE_CURRENT_SOURCE_DIR}/app/scripts/sync-vditor.mjs"
  "${CMAKE_CURRENT_SOURCE_DIR}/app/tsconfig.json"
  "${CMAKE_CURRENT_SOURCE_DIR}/app/vditor-runtime.config.json"
  "${CMAKE_CURRENT_SOURCE_DIR}/app/vite.config.ts"
  "${CMAKE_CURRENT_SOURCE_DIR}/docs/assets/sponsor.jpg")
add_custom_command(
  OUTPUT "${LWMD_FRONTEND_ZIP}"
  COMMAND "${CMAKE_COMMAND}" -E make_directory "${LWMD_GENERATED_DIR}"
  COMMAND "${NPM_EXECUTABLE}" --prefix "${CMAKE_CURRENT_SOURCE_DIR}/app" run build
  COMMAND "${CMAKE_COMMAND}" -E rm -f "${LWMD_FRONTEND_ZIP}"
  COMMAND "${CMAKE_COMMAND}" -E chdir "${CMAKE_CURRENT_SOURCE_DIR}/app/dist"
          "${CMAKE_COMMAND}" -E tar cf "${LWMD_FRONTEND_ZIP}" --format=zip .
  DEPENDS ${LWMD_FRONTEND_INPUTS}
  COMMENT "Building and packaging the lw.MD frontend"
  VERBATIM)
add_custom_target(lwmd_frontend_bundle DEPENDS "${LWMD_FRONTEND_ZIP}")
file(TO_CMAKE_PATH "${LWMD_FRONTEND_ZIP}" LWMD_FRONTEND_ZIP_RC)
configure_file(resources/frontend_bundle.rc.in "${LWMD_GENERATED_DIR}/frontend_bundle.rc" @ONLY)
set_source_files_properties("${LWMD_GENERATED_DIR}/frontend_bundle.rc"
  PROPERTIES OBJECT_DEPENDS "${LWMD_FRONTEND_ZIP}")

add_executable(lw_md WIN32
  native/app/main.cpp native/app/main_window.cpp native/app/command_line.cpp
  native/associations/file_association.cpp native/bridge/bridge_dispatcher.cpp
  native/dragdrop/file_drop_target.cpp
  native/filesystem/file_service.cpp native/filesystem/file_revision.cpp native/dialogs/file_dialog.cpp native/settings/settings.cpp
  native/images/image_service.cpp native/recovery/recovery_service.cpp
  native/resources/frontend_bundle.cpp native/resources/frontend_cache.cpp
  native/webview/webview_host.cpp resources/lw-md.rc
  resources/version.rc "${LWMD_GENERATED_DIR}/frontend_bundle.rc")
add_dependencies(lw_md lwmd_frontend_bundle)
target_include_directories(lw_md PRIVATE native ${WEBVIEW2_INCLUDE})
target_include_directories(lw_md SYSTEM PRIVATE ${miniz_SOURCE_DIR})
target_link_libraries(lw_md PRIVATE nlohmann_json::nlohmann_json miniz "${WEBVIEW2_LOADER}" ole32 shell32 comdlg32 shlwapi user32 gdi32 crypt32 advapi32 bcrypt)
target_compile_definitions(lw_md PRIVATE WIN32_LEAN_AND_MEAN NOMINMAX UNICODE _UNICODE _WIN32_WINNT=0x0A00)
target_compile_options(lw_md PRIVATE /W4 /permissive- /utf-8 /EHsc)
target_link_options(lw_md PRIVATE
  "/MANIFEST:EMBED"
  "/MANIFESTINPUT:${LWMD_MANIFEST}")
set_target_properties(lw_md PROPERTIES
  OUTPUT_NAME "lw.MD"
  LINK_DEPENDS "${LWMD_MANIFEST}")

include(CTest)
if(BUILD_TESTING)
  add_executable(lw_md_native_tests tests/native_tests.cpp native/filesystem/file_service.cpp native/filesystem/file_revision.cpp
    native/images/image_service.cpp native/recovery/recovery_service.cpp
    native/app/command_line.cpp native/associations/file_association.cpp
    native/dragdrop/file_drop_target.cpp native/settings/settings.cpp)
  target_sources(lw_md_native_tests PRIVATE native/resources/frontend_cache.cpp)
  target_include_directories(lw_md_native_tests PRIVATE native)
  target_compile_definitions(lw_md_native_tests PRIVATE WIN32_LEAN_AND_MEAN NOMINMAX UNICODE _UNICODE)
  target_compile_options(lw_md_native_tests PRIVATE /W4 /permissive- /utf-8 /EHsc)
  target_link_libraries(lw_md_native_tests PRIVATE nlohmann_json::nlohmann_json crypt32 shell32 ole32 advapi32 user32 bcrypt)
  add_test(NAME lw_md_native_tests COMMAND lw_md_native_tests)
endif()

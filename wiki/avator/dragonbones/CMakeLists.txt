cmake_minimum_required(VERSION 3.22.1)

project("dragonbones_native")

include("${CMAKE_CURRENT_LIST_DIR}/../../cmake/operit_git_source.cmake")

# The module relocation removed ignored vendored sources, so clean builds must
# populate the same runtime snapshot through the repository's archive helper.
operit_prepare_git_source(
    OPERIT_DRAGONBONES_CPP_SOURCE_DIR
    OPERIT_DRAGONBONES_CPP_BINARY_DIR
    dragonbones_cpp
    "https://github.com/DragonBones/DragonBonesCPP.git"
    "f696143045e07b7c4c4590bdd95534e9e8074b37"
)

set(DRAGONBONES_RUNTIME_ROOT "${OPERIT_DRAGONBONES_CPP_SOURCE_DIR}/DragonBones/src")
set(DRAGONBONES_RAPIDJSON_ROOT "${OPERIT_DRAGONBONES_CPP_SOURCE_DIR}/3rdParty")
set(DRAGONBONES_ANDROID_CPP_ROOT "${OPERIT_DRAGONBONES_CPP_SOURCE_DIR}/AndroidCompose/src/dragonBones/cpp")

# Gather all C++ source files from the dragonbones library
file(GLOB_RECURSE DRAGONBONES_SOURCES
    "${DRAGONBONES_RUNTIME_ROOT}/dragonBones/animation/*.cpp"
    "${DRAGONBONES_RUNTIME_ROOT}/dragonBones/armature/*.cpp"
    "${DRAGONBONES_RUNTIME_ROOT}/dragonBones/core/*.cpp"
    "${DRAGONBONES_RUNTIME_ROOT}/dragonBones/event/*.cpp"
    "${DRAGONBONES_RUNTIME_ROOT}/dragonBones/factory/*.cpp"
    "${DRAGONBONES_RUNTIME_ROOT}/dragonBones/geom/*.cpp"
    "${DRAGONBONES_RUNTIME_ROOT}/dragonBones/model/*.cpp"
    "${DRAGONBONES_RUNTIME_ROOT}/dragonBones/parser/*.cpp"
    "cpp/opengl/OpenGLSlot.cpp"
    "cpp/opengl/OpenGLFactory.cpp"
)

add_library(
    dragonbones_native
    SHARED
    "cpp/JniBridge.cpp"
    ${DRAGONBONES_SOURCES}
)

target_include_directories(dragonbones_native PRIVATE
    "cpp"
    "${DRAGONBONES_RUNTIME_ROOT}"
    "${DRAGONBONES_RAPIDJSON_ROOT}"
    "${DRAGONBONES_ANDROID_CPP_ROOT}"
)

# Link against required Android libraries
find_library(log-lib log)
find_library(GLESv2-lib GLESv2)
find_library(android-lib android)

target_link_libraries(
    dragonbones_native
    ${log-lib}
    ${GLESv2-lib}
    ${android-lib}
)

# 添加 16KB 页面大小支持（Android 15+ 要求）
target_link_options(dragonbones_native PRIVATE "-Wl,-z,max-page-size=16384")

cmake_minimum_required(VERSION 3.22.1)

project(streamnative)

include("${CMAKE_CURRENT_LIST_DIR}/../../../../cmake/operit_git_source.cmake")

function(force_release_flags_for_debug target_name)
    if(TARGET ${target_name})
        # Keep app variant as Debug, but compile heavy native libs with release-like optimization.
        target_compile_definitions(${target_name} PRIVATE $<$<CONFIG:Debug>:NDEBUG>)
        target_compile_options(${target_name} PRIVATE $<$<CONFIG:Debug>:-O3 -g0>)
    endif()
endfunction()

function(enable_16kb_page_alignment target_name)
    if(TARGET ${target_name})
        target_link_options(${target_name} PRIVATE
                "-Wl,-z,max-page-size=16384"
                "-Wl,-z,common-page-size=16384"
        )
    endif()
endfunction()

function(resolve_wamr_android_target output_var)
    if("${ANDROID_ABI}" STREQUAL "arm64-v8a")
        set(${output_var} "AARCH64" PARENT_SCOPE)
    elseif("${ANDROID_ABI}" STREQUAL "armeabi-v7a")
        set(${output_var} "ARMV7A" PARENT_SCOPE)
    elseif("${ANDROID_ABI}" STREQUAL "x86")
        set(${output_var} "X86_32" PARENT_SCOPE)
    elseif("${ANDROID_ABI}" STREQUAL "x86_64")
        set(${output_var} "X86_64" PARENT_SCOPE)
    else()
        message(FATAL_ERROR "Unsupported Android ABI for ToolPkg WAMR: ${ANDROID_ABI}")
    endif()
endfunction()

if(ANDROID)
    # Build sherpa-ncnn as part of Android Studio externalNativeBuild.
    operit_prepare_git_source(
            OPERIT_SHERPA_NCNN_SOURCE_DIR
            OPERIT_SHERPA_NCNN_BINARY_DIR
            sherpa_ncnn
            "https://github.com/k2-fsa/sherpa-ncnn.git"
            "master"
    )

    list(PREPEND CMAKE_MODULE_PATH "${CMAKE_CURRENT_SOURCE_DIR}/cmake")
    list(APPEND CMAKE_MODULE_PATH "${OPERIT_SHERPA_NCNN_SOURCE_DIR}/cmake")
    include_directories("${OPERIT_SHERPA_NCNN_SOURCE_DIR}")

    set(SHERPA_NCNN_ENABLE_PORTAUDIO OFF CACHE BOOL "" FORCE)
    set(SHERPA_NCNN_ENABLE_BINARY OFF CACHE BOOL "" FORCE)
    set(SHERPA_NCNN_ENABLE_TEST OFF CACHE BOOL "" FORCE)
    set(SHERPA_NCNN_ENABLE_C_API OFF CACHE BOOL "" FORCE)
    set(SHERPA_NCNN_ENABLE_JNI ON CACHE BOOL "" FORCE)
    set(SHERPA_NCNN_ENABLE_PYTHON OFF CACHE BOOL "" FORCE)
    set(SHERPA_NCNN_ENABLE_FFMPEG_EXAMPLES OFF CACHE BOOL "" FORCE)
    set(SHERPA_NCNN_ENABLE_GENERATE_INT8_SCALE_TABLE OFF CACHE BOOL "" FORCE)

    # Keep sherpa/ncnn static inside libsherpa-ncnn-jni and avoid OpenMP abort issues.
    set(BUILD_SHARED_LIBS OFF CACHE BOOL "" FORCE)
    set(NCNN_OPENMP OFF CACHE BOOL "" FORCE)

    add_subdirectory(
            "${OPERIT_SHERPA_NCNN_SOURCE_DIR}"
            "${OPERIT_SHERPA_NCNN_BINARY_DIR}"
    )

    force_release_flags_for_debug(ncnn)
    force_release_flags_for_debug(sherpa-ncnn-core)
    force_release_flags_for_debug(sherpa-ncnn-jni)
endif()

add_library(
        streamnative
        SHARED
        streamnative/native_xml_splitter.cpp
        streamnative/native_markdown_splitter.cpp
        streamnative/StreamOperators.cpp
        streamnative/plugins/StreamXmlPlugin.cpp
        streamnative/plugins/BaseJsonPlugin.cpp
        streamnative/plugins/StreamJsonPlugin.cpp
        streamnative/plugins/StreamPureJsonPlugin.cpp
        streamnative/plugins/StreamMarkdownPlugin.cpp
        streamnative/StreamBuilders.cpp
        streamnative/HotStream.cpp
        streamnative/StringExtensions.cpp
)

target_include_directories(
        streamnative
        PRIVATE
        ${CMAKE_CURRENT_SOURCE_DIR}
)

find_library(
        log-lib
        log
)

if(ANDROID)
    resolve_wamr_android_target(TOOLPKG_WAMR_BUILD_TARGET)
    operit_prepare_git_source(
            OPERIT_WAMR_SOURCE_DIR
            OPERIT_WAMR_BINARY_DIR
            wamr
            "https://github.com/bytecodealliance/wasm-micro-runtime.git"
            "main"
    )

    set(WAMR_ROOT_DIR "${OPERIT_WAMR_SOURCE_DIR}")
    set(WAMR_BUILD_PLATFORM "android")
    set(WAMR_BUILD_TARGET "${TOOLPKG_WAMR_BUILD_TARGET}")
    set(WAMR_BUILD_INTERP 1)
    set(WAMR_BUILD_FAST_INTERP 1)
    set(WAMR_BUILD_AOT 0)
    set(WAMR_BUILD_JIT 0)
    set(WAMR_BUILD_FAST_JIT 0)
    set(WAMR_BUILD_LIBC_BUILTIN 1)
    set(WAMR_BUILD_LIBC_WASI 0)
    set(WAMR_BUILD_LIBC_UVWASI 0)
    set(WAMR_BUILD_LIBC_EMCC 0)
    set(WAMR_BUILD_MULTI_MODULE 0)
    set(WAMR_BUILD_LIB_PTHREAD 0)
    set(WAMR_BUILD_LIB_PTHREAD_SEMAPHORE 0)
    set(WAMR_BUILD_LIB_WASI_THREADS 0)
    set(WAMR_BUILD_THREAD_MGR 0)
    set(WAMR_BUILD_SHARED_HEAP 0)
    set(WAMR_BUILD_WASI_NN 0)
    set(WAMR_BUILD_WASM_CACHE 0)
    set(WAMR_BUILD_DEBUG_INTERP 0)
    set(WAMR_BUILD_COPY_CALL_STACK 0)
    set(WAMR_BUILD_MINI_LOADER 0)
    set(WAMR_BUILD_SIMD 0)
    set(WAMR_BUILD_REF_TYPES 0)

    include("${WAMR_ROOT_DIR}/build-scripts/runtime_lib.cmake")

    add_library(
            toolpkg_wamr_vmlib
            STATIC
            ${WAMR_RUNTIME_LIB_SOURCE}
    )

    target_include_directories(
            toolpkg_wamr_vmlib
            PUBLIC
            "${WAMR_ROOT_DIR}/core/iwasm/include"
    )

    force_release_flags_for_debug(toolpkg_wamr_vmlib)
endif()

if(ANDROID)
    add_library(
            toolpkgwasm
            SHARED
            streamnative/native_toolpkg_wasm.cpp
    )

    target_include_directories(
            toolpkgwasm
            PRIVATE
            ${CMAKE_CURRENT_SOURCE_DIR}
            "${WAMR_ROOT_DIR}/core/iwasm/include"
    )
endif()

target_link_libraries(
        streamnative
        ${log-lib}
)

if(ANDROID)
    target_link_libraries(
            toolpkgwasm
            toolpkg_wamr_vmlib
            ${log-lib}
            android
            m
            dl
    )
endif()

enable_16kb_page_alignment(streamnative)
if(ANDROID)
    enable_16kb_page_alignment(toolpkgwasm)
endif()

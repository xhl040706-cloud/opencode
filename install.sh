#!/usr/bin/env bash
set -euo pipefail

MUTED='\033[0;2m'
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

BASE_URL=${COSTRICT_BASE_URL:-"https://zgsm.sangfor.com"}
export COSTRICT_BASE_URL=${COSTRICT_BASE_URL:-"https://zgsm.sangfor.com"}

usage() {
    cat <<EOF
CoStrict Installer

Usage: install.sh [options]

Options:
    -h, --help              Display this help message
    -v, --version <version> Install a specific version (e.g., 1.0.180)
    -b, --binary <path>     Install from a local binary instead of downloading

Environment Variables:
    COSTRICT_BASE_URL       Base URL for downloading (default: https://zgsm.sangfor.com)

Examples:
    curl -fsSL ${BASE_URL}/costrict-cli/install | bash
    curl -fsSL ${BASE_URL}/costrict-cli/install | bash -s -- --version 1.0.180
    COSTRICT_BASE_URL=https://custom.com curl -fsSL https://example.com/install | bash
    ./install.sh --binary /path/to/cs
EOF
}

requested_version=${VERSION:-}
binary_path=""
ENV_UPDATED=0

while [[ $# -gt 0 ]]; do
    case "$1" in
        -h|--help)
            usage
            exit 0
            ;;
        -v|--version)
            if [[ -n "${2:-}" ]]; then
                requested_version="$2"
                shift 2
            else
                echo -e "${RED}Error: --version requires a version argument${NC}"
                exit 1
            fi
            ;;
        -b|--binary)
            if [[ -n "${2:-}" ]]; then
                binary_path="$2"
                shift 2
            else
                echo -e "${RED}Error: --binary requires a path argument${NC}"
                exit 1
            fi
            ;;
        *)
            echo -e "${RED}Warning: Unknown option '$1'${NC}" >&2
            shift
            ;;
    esac
done

INSTALL_DIR=$HOME/.costrict/bin
mkdir -p "$INSTALL_DIR"

if [ -n "$binary_path" ]; then
    if [ ! -f "$binary_path" ]; then
        echo -e "${RED}Error: Binary not found at ${binary_path}${NC}"
        exit 1
    fi
    echo -e "${MUTED}Installing ${NC}cs ${MUTED}from: ${NC}$binary_path"
    cp "$binary_path" "${INSTALL_DIR}/cs"
    chmod 755 "${INSTALL_DIR}/cs"
    echo -e "${GREEN}✓ Installed successfully${NC}"
    exit 0
fi

raw_os=$(uname -s)
os=$(echo "$raw_os" | tr '[:upper:]' '[:lower:]')
case "$raw_os" in
  Darwin*) os="darwin" ;;
  Linux*) os="linux" ;;
  MINGW*|MSYS*|CYGWIN*) os="windows" ;;
esac

arch=$(uname -m)
if [[ "$arch" == "aarch64" ]]; then
  arch="arm64"
fi
if [[ "$arch" == "x86_64" ]]; then
  arch="x64"
fi

if [ "$os" = "darwin" ] && [ "$arch" = "x64" ]; then
  rosetta_flag=$(sysctl -n sysctl.proc_translated 2>/dev/null || echo 0)
  if [ "$rosetta_flag" = "1" ]; then
    arch="arm64"
  fi
fi

target="costrict-cs-$os-$arch"

if [ "$os" = "linux" ] && [ "$arch" = "x64" ]; then
  if ! grep -qi avx2 /proc/cpuinfo 2>/dev/null; then
    target="$target-baseline"
  fi
fi

if [ "$os" = "darwin" ] && [ "$arch" = "x64" ]; then
  avx2=$(sysctl -n hw.optional.avx2_0 2>/dev/null || echo 0)
  if [ "$avx2" != "1" ]; then
    target="$target-baseline"
  fi
fi

if [ "$os" = "linux" ]; then
  if [ -f /etc/alpine-release ]; then
    target="$target-musl"
  fi
  if command -v ldd >/dev/null 2>&1; then
    if ldd --version 2>&1 | grep -qi musl; then
      target="$target-musl"
    fi
  fi
fi

if [ -z "$requested_version" ]; then
  echo -e "${MUTED}No version specified, fetching latest version from server...${NC}"
  latest_url="${BASE_URL}/costrict-cli/pkg/latest.json"
  
  # Fetch latest version from latest.json
  if command -v curl >/dev/null 2>&1; then
    requested_version=$(curl -fsSL "${latest_url}" 2>/dev/null | grep -o '"tag_name":[[:space:]]*"[^"]*"' | cut -d'"' -f4)
  elif command -v wget >/dev/null 2>&1; then
    requested_version=$(wget -qO- "${latest_url}" 2>/dev/null | grep -o '"tag_name":[[:space:]]*"[^"]*"' | cut -d'"' -f4)
  fi
  
  if [ -z "$requested_version" ]; then
    echo -e "${RED}Error: Failed to fetch latest version from ${latest_url}${NC}"
    exit 1
  fi
  echo -e "${MUTED}Using latest version: ${NC}${requested_version}"
fi

requested_version="${requested_version#v}"

archive_ext=".tar.gz"
download_url="${BASE_URL}/costrict-cli/pkg/${requested_version}/${target}${archive_ext}"

echo -e "${MUTED}Downloading cs version: ${NC}${requested_version}"
echo -e "${MUTED}Target: ${NC}${target}"
echo -e "${MUTED}URL: ${NC}${download_url}"

tmp_dir="${TMPDIR:-/tmp}/costrict-cli-$$"
mkdir -p "$tmp_dir"
archive_path="${tmp_dir}/${target}${archive_ext}"

if [ -t 2 ]; then
    curl -# -L -o "$archive_path" "$download_url"
else
    curl -s -L -o "$archive_path" "$download_url"
fi

if [ ! -f "$archive_path" ] || [ ! -s "$archive_path" ]; then
    echo -e "${RED}Error: Download failed or file is empty${NC}"
    rm -rf "$tmp_dir"
    exit 1
fi

echo -e "${MUTED}Extracting archive...${NC}"
tar -xzf "$archive_path" -C "$tmp_dir"

binary_source="${tmp_dir}/bin/cs"
    if [ ! -f "$binary_source" ]; then
        echo -e "${RED}Error: Binary not found in extracted archive${NC}"
        rm -rf "$tmp_dir"
        exit 1
    fi

    mv "$binary_source" "${INSTALL_DIR}/cs"
    chmod 755 "${INSTALL_DIR}/cs"
    rm -rf "$tmp_dir"

    echo -e "${GREEN}✓ Installed successfully to: ${NC}${INSTALL_DIR}/cs"

XDG_CONFIG_HOME=${XDG_CONFIG_HOME:-$HOME/.config}
current_shell=$(basename "$SHELL")

add_to_path() {
    local config_file=$1
    local command=$2
    local base_url_export=${3:-}

    if grep -Fxq "$command" "$config_file" 2>/dev/null; then
        echo -e "${MUTED}PATH already configured in $config_file${NC}"
        return
    fi

    if [[ -w $config_file ]]; then
        echo -e "\n# costrict" >> "$config_file"
        echo "$command" >> "$config_file"
        if [[ -n "$base_url_export" ]]; then
            echo "$base_url_export" >> "$config_file"
        fi
        echo -e "${GREEN}✓ Added cs to PATH in ${NC}$config_file"
        ENV_UPDATED=1
    else
        echo -e "${MUTED}Manually add to $config_file:${NC}"
        echo "  $command"
        if [[ -n "$base_url_export" ]]; then
            echo "  $base_url_export"
        fi
    fi
}

case $current_shell in
    fish)
        config_files="$HOME/.config/fish/config.fish"
        ;;
    zsh)
        config_files="${ZDOTDIR:-$HOME}/.zshrc ${ZDOTDIR:-$HOME}/.zshenv $XDG_CONFIG_HOME/zsh/.zshrc $XDG_CONFIG_HOME/zsh/.zshenv"
        ;;
    bash)
        config_files="$HOME/.bashrc $HOME/.bash_profile $HOME/.profile $XDG_CONFIG_HOME/bash/.bashrc $XDG_CONFIG_HOME/bash/.bash_profile"
        ;;
    *)
        config_files="$HOME/.bashrc $HOME/.bash_profile"
        ;;
esac

if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
    config_file=""
    for file in $config_files; do
        if [[ -f $file ]]; then
            config_file=$file
            break
        fi
    done
    
    if [[ -z $config_file ]]; then
        echo -e "${MUTED}No config file found. Please add to PATH:${NC}"
        echo "  export PATH=$INSTALL_DIR:\$PATH"
        echo "  export COSTRICT_BASE_URL=$COSTRICT_BASE_URL"
    else
        case $current_shell in
            fish)
                add_to_path "$config_file" "fish_add_path $INSTALL_DIR" "set -gx COSTRICT_BASE_URL '$COSTRICT_BASE_URL'"
                ;;
            *)
                add_to_path "$config_file" "export PATH=$INSTALL_DIR:\$PATH" "export COSTRICT_BASE_URL='$COSTRICT_BASE_URL'"
                ;;
        esac
    fi
else
    echo -e "${GREEN}✓ PATH already configured${NC}"
fi

if [ -n "${GITHUB_ACTIONS-}" ] && [ "${GITHUB_ACTIONS}" == "true" ]; then
    echo "$INSTALL_DIR" >> $GITHUB_PATH
    echo -e "${GREEN}✓ Added to GITHUB_PATH${NC}"
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  CoStrict CLI Installation Complete${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

if [[ "$ENV_UPDATED" == "1" ]]; then
    echo -e "${RED}[!] IMPORTANT: Please restart your shell for PATH changes to take effect${NC}"
    echo ""
fi

echo -e "${MUTED}To start:${NC}"
echo ""
echo -e "cd <project>  ${MUTED}# Open directory${NC}"
echo -e "cs      ${MUTED}# Run command${NC}"
echo ""
echo -e "${MUTED}For more information visit ${NC}https://docs.costrict.ai"
echo ""

FROM fedora:41

RUN dnf install -y \
    webkit2gtk4.1 \
    webkit2gtk4.1-devel \
    gstreamer1 \
    gstreamer1-devel \
    gstreamer1-plugins-base \
    gstreamer1-plugins-base-devel \
    gstreamer1-plugins-good \
    gstreamer1-plugins-bad-free \
    pipewire-libs \
    pipewire-devel \
    rubberband \
    rubberband-devel \
    soundtouch \
    soundtouch-devel \
    sqlite \
    sqlite-devel \
    openssl-devel \
    gcc \
    gcc-c++ \
    pkgconfig \
    tar \
    file \
    wget \
    desktop-file-utils \
    && dnf clean all

# Instalacja appimagetool (wyodrębnionego, aby działał bez FUSE w kontenerze)
RUN wget -q https://github.com/AppImage/appimagetool/releases/download/continuous/appimagetool-x86_64.AppImage -O /tmp/appimagetool.AppImage && \
    chmod +x /tmp/appimagetool.AppImage && \
    cd /tmp && \
    ./appimagetool.AppImage --appimage-extract && \
    mv squashfs-root /opt/appimagetool && \
    ln -s /opt/appimagetool/AppRun /usr/local/bin/appimagetool && \
    rm -f /tmp/appimagetool.AppImage

WORKDIR /workspace

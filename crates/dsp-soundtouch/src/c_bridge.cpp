#if __has_include(<soundtouch/SoundTouch.h>)
#include <soundtouch/SoundTouch.h>
#else
#include <SoundTouch.h>
#endif

#include "c_bridge.h"
#include <new>

extern "C" {

SoundTouchHandle soundtouch_create(void) {
    try {
        return new (std::nothrow) soundtouch::SoundTouch();
    } catch (...) {
        return nullptr;
    }
}

void soundtouch_destroy(SoundTouchHandle handle) {
    if (handle) {
        try {
            delete static_cast<soundtouch::SoundTouch*>(handle);
        } catch (...) {
            // Ignorujemy wyjątki w destruktorze
        }
    }
}

int soundtouch_set_sample_rate(SoundTouchHandle handle, unsigned int sample_rate) {
    if (!handle) return -1;
    try {
        static_cast<soundtouch::SoundTouch*>(handle)->setSampleRate(sample_rate);
        return 0;
    } catch (...) {
        return -2;
    }
}

int soundtouch_set_channels(SoundTouchHandle handle, unsigned int channels) {
    if (!handle) return -1;
    try {
        static_cast<soundtouch::SoundTouch*>(handle)->setChannels(channels);
        return 0;
    } catch (...) {
        return -2;
    }
}

int soundtouch_set_rate(SoundTouchHandle handle, double rate) {
    if (!handle) return -1;
    try {
        static_cast<soundtouch::SoundTouch*>(handle)->setRate(rate);
        return 0;
    } catch (...) {
        return -2;
    }
}

int soundtouch_set_tempo(SoundTouchHandle handle, double tempo) {
    if (!handle) return -1;
    try {
        static_cast<soundtouch::SoundTouch*>(handle)->setTempo(tempo);
        return 0;
    } catch (...) {
        return -2;
    }
}

int soundtouch_set_pitch(SoundTouchHandle handle, double pitch) {
    if (!handle) return -1;
    try {
        static_cast<soundtouch::SoundTouch*>(handle)->setPitch(pitch);
        return 0;
    } catch (...) {
        return -2;
    }
}

int soundtouch_set_pitch_semitones(SoundTouchHandle handle, double semitones) {
    if (!handle) return -1;
    try {
        static_cast<soundtouch::SoundTouch*>(handle)->setPitchSemiTones(semitones);
        return 0;
    } catch (...) {
        return -2;
    }
}

int soundtouch_put_samples(SoundTouchHandle handle, const float* samples, unsigned int num_frames) {
    if (!handle || !samples || num_frames == 0) return -1;
    try {
        static_cast<soundtouch::SoundTouch*>(handle)->putSamples(samples, num_frames);
        return 0;
    } catch (...) {
        return -2;
    }
}

unsigned int soundtouch_receive_samples(SoundTouchHandle handle, float* output, unsigned int max_frames) {
    if (!handle || !output || max_frames == 0) return 0;
    try {
        return static_cast<soundtouch::SoundTouch*>(handle)->receiveSamples(output, max_frames);
    } catch (...) {
        return 0;
    }
}

unsigned int soundtouch_num_samples(SoundTouchHandle handle) {
    if (!handle) return 0;
    try {
        return static_cast<soundtouch::SoundTouch*>(handle)->numSamples();
    } catch (...) {
        return 0;
    }
}

int soundtouch_flush(SoundTouchHandle handle) {
    if (!handle) return -1;
    try {
        static_cast<soundtouch::SoundTouch*>(handle)->flush();
        return 0;
    } catch (...) {
        return -2;
    }
}

int soundtouch_clear(SoundTouchHandle handle) {
    if (!handle) return -1;
    try {
        static_cast<soundtouch::SoundTouch*>(handle)->clear();
        return 0;
    } catch (...) {
        return -2;
    }
}

int soundtouch_set_setting(SoundTouchHandle handle, int setting_id, int value) {
    if (!handle) return -1;
    try {
        bool ok = static_cast<soundtouch::SoundTouch*>(handle)->setSetting(setting_id, value);
        return ok ? 0 : -1;
    } catch (...) {
        return -2;
    }
}

int soundtouch_get_setting(SoundTouchHandle handle, int setting_id) {
    if (!handle) return -1;
    try {
        return static_cast<soundtouch::SoundTouch*>(handle)->getSetting(setting_id);
    } catch (...) {
        return -2;
    }
}

}

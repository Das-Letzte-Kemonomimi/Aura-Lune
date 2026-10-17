#ifndef SOUNDTOUCH_C_BRIDGE_H
#define SOUNDTOUCH_C_BRIDGE_H

#ifdef __cplusplus
extern "C" {
#endif

typedef void* SoundTouchHandle;

SoundTouchHandle soundtouch_create(void);
void soundtouch_destroy(SoundTouchHandle handle);

int soundtouch_set_sample_rate(SoundTouchHandle handle, unsigned int sample_rate);
int soundtouch_set_channels(SoundTouchHandle handle, unsigned int channels);
int soundtouch_set_rate(SoundTouchHandle handle, double rate);
int soundtouch_set_tempo(SoundTouchHandle handle, double tempo);
int soundtouch_set_pitch(SoundTouchHandle handle, double pitch);
int soundtouch_set_pitch_semitones(SoundTouchHandle handle, double semitones);

int soundtouch_put_samples(SoundTouchHandle handle, const float* samples, unsigned int num_frames);
unsigned int soundtouch_receive_samples(SoundTouchHandle handle, float* output, unsigned int max_frames);
unsigned int soundtouch_num_samples(SoundTouchHandle handle);

int soundtouch_flush(SoundTouchHandle handle);
int soundtouch_clear(SoundTouchHandle handle);

#ifdef __cplusplus
}
#endif

#endif // SOUNDTOUCH_C_BRIDGE_H

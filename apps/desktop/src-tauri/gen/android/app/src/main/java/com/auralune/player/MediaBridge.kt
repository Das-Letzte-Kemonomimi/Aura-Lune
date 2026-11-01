package com.auralune.player

import android.content.Context
import android.content.Intent
import android.os.Build

object MediaBridge {
    private var appContext: Context? = null

    @JvmStatic
    fun init(context: Context) {
        appContext = context.applicationContext
    }

    @JvmStatic
    fun updatePlaybackState(
        isPlaying: Boolean,
        title: String,
        artist: String,
        album: String,
        durationMs: Long,
        positionMs: Long
    ) {
        val ctx = appContext ?: return
        val intent = Intent(ctx, AuraluneMediaService::class.java).apply {
            action = AuraluneMediaService.ACTION_UPDATE_STATE
            putExtra("is_playing", isPlaying)
            putExtra("title", title)
            putExtra("artist", artist)
            putExtra("album", album)
            putExtra("duration_ms", durationMs)
            putExtra("position_ms", positionMs)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            ctx.startForegroundService(intent)
        } else {
            ctx.startService(intent)
        }
    }

    @JvmStatic
    fun stopService() {
        val ctx = appContext ?: return
        val intent = Intent(ctx, AuraluneMediaService::class.java).apply {
            action = AuraluneMediaService.ACTION_STOP
        }
        ctx.startService(intent)
    }

    // Wywołania natywne C ABI zdefiniowane w Rust (crates/audio-engine)
    @JvmStatic
    external fun nativePlay()

    @JvmStatic
    external fun nativePause()

    @JvmStatic
    external fun nativeNext()

    @JvmStatic
    external fun nativePrevious()

    @JvmStatic
    external fun nativeSeek(positionMs: Long)
}

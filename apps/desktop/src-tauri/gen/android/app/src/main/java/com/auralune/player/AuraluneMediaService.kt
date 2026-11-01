package com.auralune.player

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.MediaMetadata
import android.media.session.MediaSession
import android.media.session.PlaybackState
import android.os.Build
import android.os.IBinder

class AuraluneMediaService : Service() {

    companion object {
        const val CHANNEL_ID = "auralune_playback_channel"
        const val NOTIFICATION_ID = 1001

        const val ACTION_UPDATE_STATE = "com.auralune.player.ACTION_UPDATE_STATE"
        const val ACTION_PLAY = "com.auralune.player.ACTION_PLAY"
        const val ACTION_PAUSE = "com.auralune.player.ACTION_PAUSE"
        const val ACTION_NEXT = "com.auralune.player.ACTION_NEXT"
        const val ACTION_PREV = "com.auralune.player.ACTION_PREV"
        const val ACTION_STOP = "com.auralune.player.ACTION_STOP"
    }

    private var mediaSession: MediaSession? = null
    private var audioManager: AudioManager? = null
    private var isPlaying = false
    private var currentTitle = "Auralune"
    private var currentArtist = "Kitsune Player"
    private var currentAlbum = ""
    private var currentDuration = 0L
    private var currentPosition = 0L

    private val noisyReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action == AudioManager.ACTION_AUDIO_BECOMING_NOISY) {
                MediaBridge.nativePause()
            }
        }
    }

    private val audioFocusChangeListener = AudioManager.OnAudioFocusChangeListener { focusChange ->
        when (focusChange) {
            AudioManager.AUDIOFOCUS_LOSS,
            AudioManager.AUDIOFOCUS_LOSS_TRANSIENT -> {
                MediaBridge.nativePause()
            }
        }
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        initMediaSession()

        audioManager = getSystemService(Context.AUDIO_SERVICE) as? AudioManager
        registerReceiver(noisyReceiver, IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY))
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_PLAY -> MediaBridge.nativePlay()
            ACTION_PAUSE -> MediaBridge.nativePause()
            ACTION_NEXT -> MediaBridge.nativeNext()
            ACTION_PREV -> MediaBridge.nativePrevious()
            ACTION_STOP -> {
                MediaBridge.nativePause()
                stopForeground(true)
                stopSelf()
                return START_NOT_STICKY
            }
            ACTION_UPDATE_STATE -> {
                isPlaying = intent.getBooleanExtra("is_playing", false)
                currentTitle = intent.getStringExtra("title") ?: "Auralune"
                currentArtist = intent.getStringExtra("artist") ?: "Kitsune Player"
                currentAlbum = intent.getStringExtra("album") ?: ""
                currentDuration = intent.getLongExtra("duration_ms", 0L)
                currentPosition = intent.getLongExtra("position_ms", 0L)
                updateMediaSession()
                val notification = buildNotification()
                startForeground(NOTIFICATION_ID, notification)
            }
        }
        return START_STICKY
    }

    private fun initMediaSession() {
        mediaSession = MediaSession(this, "AuraluneMediaSession").apply {
            setCallback(object : MediaSession.Callback() {
                override fun onPlay() {
                    MediaBridge.nativePlay()
                }

                override fun onPause() {
                    MediaBridge.nativePause()
                }

                override fun onSkipToNext() {
                    MediaBridge.nativeNext()
                }

                override fun onSkipToPrevious() {
                    MediaBridge.nativePrevious()
                }

                override fun onSeekTo(pos: Long) {
                    MediaBridge.nativeSeek(pos)
                }

                override fun onStop() {
                    MediaBridge.nativePause()
                }
            })
            isActive = true
        }
    }

    private fun updateMediaSession() {
        val session = mediaSession ?: return

        val state = if (isPlaying) PlaybackState.STATE_PLAYING else PlaybackState.STATE_PAUSED
        val actions = PlaybackState.ACTION_PLAY or
                PlaybackState.ACTION_PAUSE or
                PlaybackState.ACTION_PLAY_PAUSE or
                PlaybackState.ACTION_SKIP_TO_NEXT or
                PlaybackState.ACTION_SKIP_TO_PREVIOUS or
                PlaybackState.ACTION_SEEK_TO

        val playbackState = PlaybackState.Builder()
            .setActions(actions)
            .setState(state, currentPosition, 1.0f)
            .build()
        session.setPlaybackState(playbackState)

        val metadata = MediaMetadata.Builder()
            .putString(MediaMetadata.METADATA_KEY_TITLE, currentTitle)
            .putString(MediaMetadata.METADATA_KEY_ARTIST, currentArtist)
            .putString(MediaMetadata.METADATA_KEY_ALBUM, currentAlbum)
            .putLong(MediaMetadata.METADATA_KEY_DURATION, currentDuration)
            .build()
        session.setMetadata(metadata)
    }

    private fun buildNotification(): Notification {
        val session = mediaSession
        val openAppIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val contentPendingIntent = PendingIntent.getActivity(
            this, 0, openAppIntent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val prevPending = PendingIntent.getService(
            this, 1, Intent(this, AuraluneMediaService::class.java).apply { action = ACTION_PREV },
            PendingIntent.FLAG_IMMUTABLE
        )
        val playPauseAction = if (isPlaying) ACTION_PAUSE else ACTION_PLAY
        val playPausePending = PendingIntent.getService(
            this, 2, Intent(this, AuraluneMediaService::class.java).apply { action = playPauseAction },
            PendingIntent.FLAG_IMMUTABLE
        )
        val nextPending = PendingIntent.getService(
            this, 3, Intent(this, AuraluneMediaService::class.java).apply { action = ACTION_NEXT },
            PendingIntent.FLAG_IMMUTABLE
        )

        val playPauseIcon = if (isPlaying) android.R.drawable.ic_media_pause else android.R.drawable.ic_media_play

        val builder = Notification.Builder(this, CHANNEL_ID)
            .setContentTitle(currentTitle)
            .setContentText(currentArtist)
            .setSubText(currentAlbum)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentIntent(contentPendingIntent)
            .setVisibility(Notification.VISIBILITY_PUBLIC)
            .setOngoing(isPlaying)
            .addAction(android.R.drawable.ic_media_previous, "Poprzedni", prevPending)
            .addAction(playPauseIcon, if (isPlaying) "Pauza" else "Odtwarzaj", playPausePending)
            .addAction(android.R.drawable.ic_media_next, "Następny", nextPending)

        if (session != null) {
            builder.style = Notification.MediaStyle()
                .setMediaSession(session.sessionToken)
                .setShowActionsInCompactView(0, 1, 2)
        }

        return builder.build()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Auralune Odtwarzacz",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Powiadomienia odtwarzacza muzyki Auralune z kontrolą mediów"
                setShowBadge(false)
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager?.createNotificationChannel(channel)
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        try {
            unregisterReceiver(noisyReceiver)
        } catch (_: Exception) {}
        mediaSession?.isActive = false
        mediaSession?.release()
        mediaSession = null
        super.onDestroy()
    }
}

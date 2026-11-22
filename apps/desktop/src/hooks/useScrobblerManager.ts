import { useState, useEffect, useCallback } from 'react';
import { invoke } from '../api/ipc';
import type { Translations } from '../i18n';

export interface UseScrobblerManagerOptions {
  isSettingsOpen: boolean;
  showMessage: (msg: string, isError?: boolean) => void;
  loc: Translations;
}

export function useScrobblerManager({
  isSettingsOpen,
  showMessage,
  loc,
}: UseScrobblerManagerOptions) {
  // 1. Discord RPC State
  const [discordRpcEnabled, setDiscordRpcEnabled] = useState<boolean>(true);
  const [discordRpcConnected, setDiscordRpcConnected] = useState<boolean>(false);
  const [discordClientId, setDiscordClientId] = useState<string>('1563876157387186226');
  const [isEditingDiscordClientId, setIsEditingDiscordClientId] = useState<boolean>(false);

  const handleToggleDiscordRpc = useCallback(async (enabled: boolean) => {
    setDiscordRpcEnabled(enabled);
    try {
      await invoke('set_discord_rpc_enabled', { enabled });
      showMessage(
        enabled
          ? loc.notifications.discordRpcOn
          : loc.notifications.discordRpcOff
      );
      const st = await invoke<{ enabled: boolean; connected: boolean; client_id: string }>('get_discord_rpc_status');
      if (st) {
        setDiscordRpcConnected(st.connected);
      }
    } catch (e: unknown) {
      console.warn('Error in set_discord_rpc_enabled:', e);
    }
  }, [loc.notifications.discordRpcOff, loc.notifications.discordRpcOn, showMessage]);

  const handleSaveDiscordClientId = useCallback(async (newId: string) => {
    const finalId = newId.trim() || '1563876157387186226';
    setDiscordClientId(finalId);
    setIsEditingDiscordClientId(false);
    try {
      await invoke('set_discord_rpc_client_id', { clientId: finalId });
      showMessage('Zaktualizowano identyfikator Discord Application ID');
    } catch (e: unknown) {
      console.warn('Error in set_discord_rpc_client_id:', e);
    }
  }, [showMessage]);

  useEffect(() => {
    invoke<{ enabled: boolean; connected: boolean; client_id: string }>('get_discord_rpc_status')
      .then((st) => {
        if (st) {
          setDiscordRpcEnabled(st.enabled);
          setDiscordRpcConnected(st.connected);
          const cid = st.client_id || '1563876157387186226';
          setDiscordClientId(cid);
        }
      })
      .catch((e) => console.warn('Error reading get_discord_rpc_status:', e));

    invoke<string | null>('get_app_setting', { key: 'listenbrainz_token' })
      .then((val) => {
        if (val) setListenbrainzToken(val);
      })
      .catch((e) => console.warn('Error reading listenbrainz_token:', e));

    invoke<string | null>('get_app_setting', { key: 'listenbrainz_enabled' })
      .then((val) => {
        if (val !== null && val !== undefined) setListenbrainzEnabled(val === 'true');
      })
      .catch((e) => console.warn('Error reading listenbrainz_enabled:', e));

    invoke<string | null>('get_app_setting', { key: 'lastfm_session_key' })
      .then((val) => {
        if (val) setLastfmSessionKey(val);
      })
      .catch(() => {});

    invoke<string | null>('get_app_setting', { key: 'lastfm_username' })
      .then((val) => {
        if (val) setLastfmUsername(val);
      })
      .catch(() => {});

    invoke<string | null>('get_app_setting', { key: 'lastfm_enabled' })
      .then((val) => {
        if (val !== null && val !== undefined) setLastfmEnabled(val === 'true');
      })
      .catch(() => {});

    invoke<string | null>('get_app_setting', { key: 'lastfm_custom_key' })
      .then((val) => {
        if (val) setLastfmCustomKey(val);
      })
      .catch(() => {});

    invoke<string | null>('get_app_setting', { key: 'lastfm_custom_secret' })
      .then((val) => {
        if (val) setLastfmCustomSecret(val);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isSettingsOpen) return;
    const interval = setInterval(() => {
      invoke<{ enabled: boolean; connected: boolean; client_id: string }>('get_discord_rpc_status')
        .then((st) => {
          if (st) {
            setDiscordRpcEnabled(st.enabled);
            setDiscordRpcConnected(st.connected);
            if (!isEditingDiscordClientId) {
              setDiscordClientId(st.client_id || '1563876157387186226');
            }
          }
        })
        .catch(() => {});
    }, 3000);
    return () => clearInterval(interval);
  }, [isEditingDiscordClientId, isSettingsOpen]);

  // 2. ListenBrainz Scrobbler State
  const [listenbrainzToken, setListenbrainzToken] = useState<string>('');
  const [listenbrainzEnabled, setListenbrainzEnabled] = useState<boolean>(false);
  const [listenbrainzUser, setListenbrainzUser] = useState<string | null>(null);
  const [listenbrainzTesting, setListenbrainzTesting] = useState<boolean>(false);
  const [listenbrainzStatusMsg, setListenbrainzStatusMsg] = useState<string | null>(null);
  const [scrobbledTrackId, setScrobbledTrackId] = useState<number | null>(null);

  const handleTestListenbrainz = useCallback(async () => {
    if (!listenbrainzToken.trim()) {
      setListenbrainzStatusMsg(loc.settings.listenbrainzInvalid);
      return;
    }
    setListenbrainzTesting(true);
    setListenbrainzStatusMsg(null);
    try {
      const userName = await invoke<string>('validate_listenbrainz_token', { token: listenbrainzToken.trim() });
      setListenbrainzUser(userName);
      setListenbrainzStatusMsg(`${loc.settings.listenbrainzValid}: @${userName}`);
      await invoke('set_app_setting', { key: 'listenbrainz_token', value: listenbrainzToken.trim() });
      showMessage(`ListenBrainz: Zalogowano jako @${userName}`);
    } catch (err: unknown) {
      setListenbrainzUser(null);
      setListenbrainzStatusMsg(`${loc.settings.listenbrainzInvalid}: ${String(err)}`);
    } finally {
      setListenbrainzTesting(false);
    }
  }, [listenbrainzToken, loc.settings.listenbrainzInvalid, loc.settings.listenbrainzValid, showMessage]);

  const handleToggleListenbrainz = useCallback(async (enabled: boolean) => {
    setListenbrainzEnabled(enabled);
    try {
      await invoke('set_app_setting', { key: 'listenbrainz_enabled', value: enabled ? 'true' : 'false' });
      showMessage(
        enabled
          ? loc.notifications.listenbrainzOn
          : loc.notifications.listenbrainzOff
      );
    } catch (e) {
      console.warn('Error saving listenbrainz_enabled:', e);
    }
  }, [loc.notifications.listenbrainzOff, loc.notifications.listenbrainzOn, showMessage]);

  const handleListenbrainzTokenChange = useCallback(async (token: string) => {
    setListenbrainzToken(token);
    try {
      await invoke('set_app_setting', { key: 'listenbrainz_token', value: token });
    } catch (e) {
      console.warn('Error saving listenbrainz_token:', e);
    }
  }, []);

  // 3. Last.fm Scrobbler State
  const [lastfmSessionKey, setLastfmSessionKey] = useState<string>('');
  const [lastfmUsername, setLastfmUsername] = useState<string | null>(null);
  const [lastfmEnabled, setLastfmEnabled] = useState<boolean>(false);
  const [lastfmTesting, setLastfmTesting] = useState<boolean>(false);
  const [lastfmStatusMsg, setLastfmStatusMsg] = useState<string | null>(null);
  const [lastfmPendingToken, setLastfmPendingToken] = useState<string | null>(null);
  const [lastfmCustomKey, setLastfmCustomKey] = useState<string>('');
  const [lastfmCustomSecret, setLastfmCustomSecret] = useState<string>('');
  const [lastfmScrobbledTrackId, setLastfmScrobbledTrackId] = useState<number | null>(null);

  const handleConnectLastfm = useCallback(async () => {
    setLastfmTesting(true);
    setLastfmStatusMsg(null);
    try {
      const res = await invoke<{ token: string; auth_url: string }>('lastfm_get_auth_url', {
        apiKey: lastfmCustomKey.trim() || null,
      });
      setLastfmPendingToken(res.token);
      window.open(res.auth_url, '_blank');
      setLastfmStatusMsg(loc.settings.lastfmAuthWaiting);
    } catch (err: unknown) {
      setLastfmStatusMsg(`${loc.settings.lastfmInvalidSession}: ${String(err)}`);
    } finally {
      setLastfmTesting(false);
    }
  }, [lastfmCustomKey, loc.settings.lastfmAuthWaiting, loc.settings.lastfmInvalidSession]);

  const handleConfirmLastfmAuth = useCallback(async () => {
    if (!lastfmPendingToken) return;
    setLastfmTesting(true);
    try {
      const session = await invoke<{ username: string; session_key: string }>('lastfm_fetch_session', {
        token: lastfmPendingToken,
        apiKey: lastfmCustomKey.trim() || null,
        apiSecret: lastfmCustomSecret.trim() || null,
      });
      setLastfmSessionKey(session.session_key);
      setLastfmUsername(session.username);
      setLastfmPendingToken(null);
      setLastfmStatusMsg(`${loc.settings.lastfmConnectedAs}: @${session.username}`);
      await invoke('set_app_setting', { key: 'lastfm_session_key', value: session.session_key });
      await invoke('set_app_setting', { key: 'lastfm_username', value: session.username });
      showMessage(loc.notifications.lastfmLoginSuccess.replace('{0}', session.username));
    } catch (err: unknown) {
      setLastfmStatusMsg(`${loc.settings.lastfmInvalidSession}: ${String(err)}`);
    } finally {
      setLastfmTesting(false);
    }
  }, [lastfmCustomKey, lastfmCustomSecret, lastfmPendingToken, loc.notifications.lastfmLoginSuccess, loc.settings.lastfmConnectedAs, loc.settings.lastfmInvalidSession, showMessage]);

  const handleDisconnectLastfm = useCallback(async () => {
    setLastfmSessionKey('');
    setLastfmUsername(null);
    setLastfmPendingToken(null);
    setLastfmStatusMsg(null);
    await invoke('set_app_setting', { key: 'lastfm_session_key', value: '' });
    await invoke('set_app_setting', { key: 'lastfm_username', value: '' });
    showMessage(loc.notifications.lastfmDisconnected);
  }, [loc.notifications.lastfmDisconnected, showMessage]);

  const handleManualLastfmSessionKeyChange = useCallback(async (key: string) => {
    setLastfmSessionKey(key);
    await invoke('set_app_setting', { key: 'lastfm_session_key', value: key });
  }, []);

  const handleValidateLastfmSession = useCallback(async () => {
    if (!lastfmSessionKey.trim()) return;
    setLastfmTesting(true);
    try {
      const user = await invoke<string>('lastfm_validate_session', {
        sessionKey: lastfmSessionKey.trim(),
        apiKey: lastfmCustomKey.trim() || null,
        apiSecret: lastfmCustomSecret.trim() || null,
      });
      setLastfmUsername(user);
      setLastfmStatusMsg(`${loc.settings.lastfmConnectedAs}: @${user}`);
      await invoke('set_app_setting', { key: 'lastfm_username', value: user });
      showMessage(loc.notifications.lastfmConnected.replace('{0}', user));
    } catch (err: unknown) {
      setLastfmStatusMsg(`${loc.settings.lastfmInvalidSession}: ${String(err)}`);
    } finally {
      setLastfmTesting(false);
    }
  }, [lastfmCustomKey, lastfmCustomSecret, lastfmSessionKey, loc.notifications.lastfmConnected, loc.settings.lastfmConnectedAs, loc.settings.lastfmInvalidSession, showMessage]);

  const handleToggleLastfm = useCallback(async (enabled: boolean) => {
    setLastfmEnabled(enabled);
    try {
      await invoke('set_app_setting', { key: 'lastfm_enabled', value: enabled ? 'true' : 'false' });
      showMessage(
        enabled
          ? loc.notifications.lastfmOn
          : loc.notifications.lastfmOff
      );
    } catch (e) {
      console.warn('Error saving lastfm_enabled:', e);
    }
  }, [loc.notifications.lastfmOff, loc.notifications.lastfmOn, showMessage]);

  const handleSaveLastfmCustomKeys = useCallback(async (key: string, secret: string) => {
    setLastfmCustomKey(key);
    setLastfmCustomSecret(secret);
    await invoke('set_app_setting', { key: 'lastfm_custom_key', value: key });
    await invoke('set_app_setting', { key: 'lastfm_custom_secret', value: secret });
  }, []);

  return {
    discordRpcEnabled,
    setDiscordRpcEnabled,
    discordRpcConnected,
    setDiscordRpcConnected,
    discordClientId,
    setDiscordClientId,
    isEditingDiscordClientId,
    setIsEditingDiscordClientId,
    handleToggleDiscordRpc,
    handleSaveDiscordClientId,
    listenbrainzToken,
    setListenbrainzToken,
    listenbrainzEnabled,
    setListenbrainzEnabled,
    listenbrainzUser,
    setListenbrainzUser,
    listenbrainzTesting,
    listenbrainzStatusMsg,
    scrobbledTrackId,
    setScrobbledTrackId,
    handleTestListenbrainz,
    handleToggleListenbrainz,
    handleListenbrainzTokenChange,
    lastfmSessionKey,
    setLastfmSessionKey,
    lastfmUsername,
    setLastfmUsername,
    lastfmEnabled,
    setLastfmEnabled,
    lastfmTesting,
    lastfmStatusMsg,
    lastfmPendingToken,
    lastfmCustomKey,
    setLastfmCustomKey,
    lastfmCustomSecret,
    setLastfmCustomSecret,
    lastfmScrobbledTrackId,
    setLastfmScrobbledTrackId,
    handleConnectLastfm,
    handleConfirmLastfmAuth,
    handleDisconnectLastfm,
    handleManualLastfmSessionKeyChange,
    handleValidateLastfmSession,
    handleToggleLastfm,
    handleSaveLastfmCustomKeys,
  };
}

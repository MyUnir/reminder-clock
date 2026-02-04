import React, { useState, useEffect, useRef } from 'react';
import { Clock, Play, Pause, Volume2, Bell, Calendar, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { toast } from 'sonner';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Audio URLs
const AUDIO_FILES = {
  indonesiaRaya: 'https://customer-assets.emergentagent.com/job_sinarmas-hymne/artifacts/j0j6g9by_Indonesia%20Raya.mp3',
  hymneSinarmas: 'https://customer-assets.emergentagent.com/job_sinarmas-hymne/artifacts/ygt1gwqo_Hymne%20Sinar%20Mas.mp3',
  sirine: 'https://customer-assets.emergentagent.com/job_sinarmas-hymne/artifacts/kx4nuwo8_air-raid-siren-sound-effect-241383.mp3',
  chime: 'https://customer-assets.emergentagent.com/job_sinarmas-hymne/artifacts/y9v25g88_chime-2-356833.mp3'
};

// Schedule Configuration
const SCHEDULE_CONFIG = {
  blokNasional: { hour: 7, minute: 50, days: [1, 2, 3, 4, 5] }, // Mon-Fri
  sirineKerja: {
    senin_kamis: [
      { hour: 8, minute: 0 },
      { hour: 12, minute: 0 },
      { hour: 13, minute: 0 },
      { hour: 17, minute: 0 }
    ],
    jumat: [
      { hour: 8, minute: 0 },
      { hour: 11, minute: 30 },
      { hour: 12, minute: 30 },
      { hour: 17, minute: 0 }
    ]
  }
};

const Dashboard = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [nextEvent, setNextEvent] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPlayingEvent, setCurrentPlayingEvent] = useState(null);
  const [logs, setLogs] = useState([]);
  const [volume, setVolume] = useState(0.8);
  
  const audioRef = useRef(null);
  const intervalRef = useRef(null);
  const lastReminderHour = useRef(-1);
  const lastPlayedEvent = useRef(null);

  // Request notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Calculate next event
  const calculateNextEvent = (now) => {
    const day = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const hour = now.getHours();
    const minute = now.getMinutes();
    const currentMinutes = hour * 60 + minute;

    let events = [];

    // Blok Nasional
    if (SCHEDULE_CONFIG.blokNasional.days.includes(day)) {
      const blokTime = SCHEDULE_CONFIG.blokNasional.hour * 60 + SCHEDULE_CONFIG.blokNasional.minute;
      if (currentMinutes < blokTime) {
        events.push({
          type: 'Blok Nasional',
          hour: SCHEDULE_CONFIG.blokNasional.hour,
          minute: SCHEDULE_CONFIG.blokNasional.minute,
          timeInMinutes: blokTime
        });
      }
    }

    // Sirine Kerja
    if (day >= 1 && day <= 5) {
      const schedule = day === 5 ? SCHEDULE_CONFIG.sirineKerja.jumat : SCHEDULE_CONFIG.sirineKerja.senin_kamis;
      schedule.forEach(s => {
        const sirineTime = s.hour * 60 + s.minute;
        if (currentMinutes < sirineTime) {
          events.push({
            type: 'Sirine Kerja',
            hour: s.hour,
            minute: s.minute,
            timeInMinutes: sirineTime
          });
        }
      });
    }

    // Sort and get next event
    events.sort((a, b) => a.timeInMinutes - b.timeInMinutes);
    return events.length > 0 ? events[0] : null;
  };

  // Play audio
  const playAudio = async (url, eventName) => {
    if (audioRef.current) {
      audioRef.current.pause();
    }

    const audio = new Audio(url);
    audio.volume = volume;
    audioRef.current = audio;

    setIsPlaying(true);
    setCurrentPlayingEvent(eventName);

    audio.onended = () => {
      setIsPlaying(false);
      setCurrentPlayingEvent(null);
      audioRef.current = null;
    };

    try {
      await audio.play();
      toast.success(`Memainkan: ${eventName}`);
    } catch (error) {
      console.error('Audio play error:', error);
      toast.error('Gagal memutar audio. Pastikan browser mengizinkan autoplay.');
      setIsPlaying(false);
      setCurrentPlayingEvent(null);
    }
  };

  // Play Blok Nasional (Indonesia Raya -> Hymne Sinarmas)
  const playBlokNasional = async () => {
    const eventKey = `blok_${currentTime.getHours()}_${currentTime.getMinutes()}`;
    if (lastPlayedEvent.current === eventKey) return;
    lastPlayedEvent.current = eventKey;

    await playAudio(AUDIO_FILES.indonesiaRaya, 'Indonesia Raya');
    
    // Wait for Indonesia Raya to finish, then play Hymne
    const checkInterval = setInterval(() => {
      if (!audioRef.current || audioRef.current.ended) {
        clearInterval(checkInterval);
        setTimeout(() => {
          playAudio(AUDIO_FILES.hymneSinarmas, 'Hymne Sinarmas');
        }, 500);
      }
    }, 500);

    // Send notification
    if (Notification.permission === 'granted') {
      new Notification('Blok Nasional', {
        body: 'Indonesia Raya & Hymne Sinarmas',
        icon: '/logo192.png'
      });
    }

    // Log activity
    try {
      await axios.post(`${API}/activity-log`, {
        event_type: 'blok_nasional',
        event_time: currentTime.toLocaleTimeString('id-ID'),
        description: 'Blok Nasional dimainkan'
      });
    } catch (error) {
      console.error('Failed to log activity:', error);
    }

    addLog('Blok Nasional', 'Indonesia Raya & Hymne Sinarmas');
  };

  // Play Sirine
  const playSirine = async () => {
    const eventKey = `sirine_${currentTime.getHours()}_${currentTime.getMinutes()}`;
    if (lastPlayedEvent.current === eventKey) return;
    lastPlayedEvent.current = eventKey;

    await playAudio(AUDIO_FILES.sirine, 'Sirine Kerja');

    if (Notification.permission === 'granted') {
      new Notification('Sirine Kerja', {
        body: 'Waktu kerja',
        icon: '/logo192.png'
      });
    }

    try {
      await axios.post(`${API}/activity-log`, {
        event_type: 'sirine_kerja',
        event_time: currentTime.toLocaleTimeString('id-ID'),
        description: 'Sirine kerja dimainkan'
      });
    } catch (error) {
      console.error('Failed to log activity:', error);
    }

    addLog('Sirine Kerja', 'Waktu kerja');
  };

  // Play hourly reminder
  const playReminder = async () => {
    await playAudio(AUDIO_FILES.chime, 'Reminder Jam');

    if (Notification.permission === 'granted') {
      new Notification('Reminder', {
        body: `Pukul ${currentTime.getHours()}:00`,
        icon: '/logo192.png'
      });
    }

    try {
      await axios.post(`${API}/activity-log`, {
        event_type: 'reminder',
        event_time: currentTime.toLocaleTimeString('id-ID'),
        description: 'Reminder jam dimainkan'
      });
    } catch (error) {
      console.error('Failed to log activity:', error);
    }

    addLog('Reminder Jam', `Pukul ${currentTime.getHours()}:00`);
  };

  // Add log to UI
  const addLog = (type, description) => {
    const newLog = {
      type,
      description,
      time: new Date().toLocaleTimeString('id-ID')
    };
    setLogs(prev => [newLog, ...prev].slice(0, 10));
  };

  // Check schedule
  const checkSchedule = () => {
    const now = new Date();
    setCurrentTime(now);

    const day = now.getDay();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const second = now.getSeconds();

    // Only trigger at exact seconds = 0
    if (second !== 0) return;

    // Check Blok Nasional (07:50)
    if (day >= 1 && day <= 5 && hour === 7 && minute === 50) {
      playBlokNasional();
      return;
    }

    // Check Sirine Kerja
    if (day >= 1 && day <= 5) {
      const schedule = day === 5 ? SCHEDULE_CONFIG.sirineKerja.jumat : SCHEDULE_CONFIG.sirineKerja.senin_kamis;
      const shouldPlaySirine = schedule.some(s => s.hour === hour && s.minute === minute);
      if (shouldPlaySirine) {
        playSirine();
        return;
      }
    }

    // Check hourly reminder (every hour at :00)
    if (minute === 0 && lastReminderHour.current !== hour) {
      lastReminderHour.current = hour;
      playReminder();
    }
  };

  // Start/Stop system
  const toggleSystem = () => {
    if (isRunning) {
      // Stop
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setIsRunning(false);
      setIsPlaying(false);
      setCurrentPlayingEvent(null);
      toast.info('Sistem dihentikan');
    } else {
      // Start
      setIsRunning(true);
      intervalRef.current = setInterval(checkSchedule, 1000);
      toast.success('Sistem dimulai');
    }
  };

  // Test audio
  const testAudio = async () => {
    await playAudio(AUDIO_FILES.chime, 'Test Audio');
  };

  // Update next event
  useEffect(() => {
    const next = calculateNextEvent(currentTime);
    setNextEvent(next);
  }, [currentTime]);

  // Get today's schedule
  const getTodaySchedule = () => {
    const day = currentTime.getDay();
    let schedule = [];

    // Blok Nasional
    if (day >= 1 && day <= 5) {
      schedule.push({
        type: 'Blok Nasional',
        time: '07:50',
        description: 'Indonesia Raya & Hymne Sinarmas',
        sortTime: 750
      });
    }

    // Sirine Kerja
    if (day >= 1 && day <= 5) {
      const times = day === 5 ? SCHEDULE_CONFIG.sirineKerja.jumat : SCHEDULE_CONFIG.sirineKerja.senin_kamis;
      times.forEach(t => {
        schedule.push({
          type: 'Sirine Kerja',
          time: `${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}`,
          description: 'Waktu kerja',
          sortTime: t.hour * 100 + t.minute
        });
      });
    }

    // Reminder Jam (setiap jam dari 07:00 - 18:00)
    for (let hour = 7; hour <= 18; hour++) {
      schedule.push({
        type: 'Reminder Jam',
        time: `${String(hour).padStart(2, '0')}:00`,
        description: 'Pengingat waktu',
        sortTime: hour * 100
      });
    }

    // Sort by time
    schedule.sort((a, b) => a.sortTime - b.sortTime);

    return schedule;
  };

  const todaySchedule = getTodaySchedule();
  const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold text-primary tracking-tight">
              Sinarmas Reminder System
            </h1>
            <p className="text-muted-foreground mt-2">Jadwal Kerja Otomatis</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold mono text-primary" data-testid="current-time-display">
              {currentTime.toLocaleTimeString('id-ID')}
            </div>
            <div className="text-sm text-muted-foreground">
              {dayNames[currentTime.getDay()]}, {currentTime.toLocaleDateString('id-ID')}
            </div>
          </div>
        </header>

        {/* Hero Status Card */}
        <Card className="hero-bg rounded-xl shadow-xl overflow-hidden" data-testid="hero-status-card">
          <div className="hero-content p-8 md:p-12">
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className={`h-4 w-4 rounded-full ${isRunning ? 'bg-green-500 pulse-active' : 'bg-red-500'}`} data-testid="system-status-indicator"></div>
                  <span className="text-white font-semibold text-lg">
                    Status: {isRunning ? 'Berjalan' : 'Berhenti'}
                  </span>
                </div>
                <h2 className="text-3xl font-bold text-white mb-2">Jadwal Berikutnya</h2>
                {nextEvent ? (
                  <div className="bg-white/20 backdrop-blur-md rounded-lg p-4 border border-white/30" data-testid="next-event-card">
                    <div className="text-amber-300 font-semibold text-sm mb-1">{nextEvent.type}</div>
                    <div className="text-white text-4xl font-bold mono">
                      {String(nextEvent.hour).padStart(2, '0')}:{String(nextEvent.minute).padStart(2, '0')}
                    </div>
                  </div>
                ) : (
                  <div className="text-white/70">Tidak ada jadwal hari ini</div>
                )}
              </div>
              <div className="flex flex-col justify-center gap-4">
                <Button
                  onClick={toggleSystem}
                  size="lg"
                  className={`w-full text-lg py-7 ${isRunning ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'} text-white shadow-lg hover:shadow-xl smooth-transition`}
                  data-testid="toggle-system-button"
                >
                  {isRunning ? (
                    <><Pause className="mr-2 h-6 w-6" /> Stop Sistem</>
                  ) : (
                    <><Play className="mr-2 h-6 w-6" /> Start Sistem</>
                  )}
                </Button>
                <Button
                  onClick={testAudio}
                  variant="outline"
                  size="lg"
                  className="w-full bg-white/90 hover:bg-white text-primary border-white/50 py-6"
                  data-testid="test-audio-button"
                >
                  <Volume2 className="mr-2 h-5 w-5" /> Test Audio
                </Button>
              </div>
            </div>
            {isPlaying && currentPlayingEvent && (
              <div className="mt-6 bg-amber-500/20 backdrop-blur-md border border-amber-400/30 rounded-lg p-4" data-testid="now-playing-indicator">
                <div className="flex items-center gap-3">
                  <div className="animate-pulse bg-amber-400 h-3 w-3 rounded-full"></div>
                  <span className="text-white font-semibold">Sedang Memutar: {currentPlayingEvent}</span>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Today's Schedule */}
          <Card className="rounded-xl shadow-lg p-6" data-testid="today-schedule-card">
            <div className="flex items-center gap-3 mb-6">
              <Calendar className="h-6 w-6 text-amber-600" />
              <h3 className="text-2xl font-semibold text-primary">Jadwal Hari Ini</h3>
            </div>
            <div className="space-y-3">
              {todaySchedule.length > 0 ? (
                todaySchedule.map((item, index) => {
                  const now = currentTime.getHours() * 60 + currentTime.getMinutes();
                  const [h, m] = item.time.split(':').map(Number);
                  const itemTime = h * 60 + m;
                  const isPast = now > itemTime;
                  const isNext = nextEvent && item.time === `${String(nextEvent.hour).padStart(2, '0')}:${String(nextEvent.minute).padStart(2, '0')}`;

                  return (
                    <div
                      key={index}
                      className={`p-4 rounded-lg border smooth-transition ${
                        isNext ? 'border-amber-500 bg-amber-50 shadow-md' : isPast ? 'border-slate-200 bg-slate-50 opacity-60' : 'border-slate-200 bg-white'
                      }`}
                      data-testid={`schedule-item-${index}`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-primary">{item.type}</div>
                          <div className="text-sm text-muted-foreground">{item.description}</div>
                        </div>
                        <div className="flex items-center gap-3">
                          {isPast && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                          {isNext && <AlertCircle className="h-5 w-5 text-amber-500" />}
                          <div className="text-2xl font-bold mono text-primary">{item.time}</div>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center text-muted-foreground py-8">Tidak ada jadwal untuk hari ini</div>
              )}
            </div>
            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-start gap-2">
                <Bell className="h-5 w-5 text-blue-600 mt-0.5" />
                <div className="text-sm text-blue-900">
                  <strong>Reminder Jam:</strong> Berbunyi setiap jam (00 menit)
                </div>
              </div>
            </div>
          </Card>

          {/* Activity Log */}
          <Card className="rounded-xl shadow-lg p-6" data-testid="activity-log-card">
            <div className="flex items-center gap-3 mb-6">
              <Clock className="h-6 w-6 text-amber-600" />
              <h3 className="text-2xl font-semibold text-primary">Log Aktivitas</h3>
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {logs.length > 0 ? (
                logs.map((log, index) => (
                  <div
                    key={index}
                    className="p-3 bg-slate-50 rounded-lg border border-slate-200 smooth-transition hover:bg-slate-100"
                    data-testid={`activity-log-${index}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-sm text-primary">{log.type}</div>
                        <div className="text-xs text-muted-foreground">{log.description}</div>
                      </div>
                      <div className="text-xs mono text-muted-foreground">{log.time}</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-muted-foreground py-8">Belum ada aktivitas</div>
              )}
            </div>
          </Card>
        </div>

        {/* Footer Info */}
        <Card className="rounded-xl shadow-lg p-6 bg-gradient-to-r from-slate-900 to-slate-800 text-white">
          <div className="grid md:grid-cols-3 gap-6 text-center">
            <div>
              <div className="text-amber-400 font-semibold mb-2">Blok Nasional</div>
              <div className="text-sm">Senin - Jumat, 07:50</div>
              <div className="text-xs text-slate-300 mt-1">Indonesia Raya & Hymne Sinarmas</div>
            </div>
            <div>
              <div className="text-amber-400 font-semibold mb-2">Sirine Kerja</div>
              <div className="text-sm">Sen-Kam: 08:00, 12:00, 13:00, 17:00</div>
              <div className="text-xs text-slate-300 mt-1">Jumat: 08:00, 11:30, 12:30, 17:00</div>
            </div>
            <div>
              <div className="text-amber-400 font-semibold mb-2">Reminder Jam</div>
              <div className="text-sm">Setiap jam (00 menit)</div>
              <div className="text-xs text-slate-300 mt-1">Pengingat waktu</div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
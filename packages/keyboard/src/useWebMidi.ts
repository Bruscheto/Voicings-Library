import { useEffect, useRef, useState } from 'react';

const NOTE_ON = 0x90;
const NOTE_OFF = 0x80;
const COMMAND_MASK = 0xf0;

export type MidiStatus = 'connecting' | 'ready' | 'no-devices' | 'unsupported' | 'denied';

type Handlers = { onNoteOn: (midi: number) => void; onNoteOff: (midi: number) => void };

/** Listen to every MIDI input, including ones plugged in after load. */
export function useWebMidi(handlers: Handlers): MidiStatus {
  const [status, setStatus] = useState<MidiStatus>('connecting');
  const latest = useRef(handlers);
  latest.current = handlers;

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.requestMIDIAccess) {
      setStatus('unsupported');
      return;
    }
    let access: MIDIAccess | null = null;
    let cancelled = false;

    const onMessage = (event: MIDIMessageEvent) => {
      if (!event.data || event.data.length < 3) return;
      const [status, note, velocity] = event.data;
      const command = status & COMMAND_MASK;
      if (command === NOTE_ON && velocity > 0) latest.current.onNoteOn(note);
      else if (command === NOTE_OFF || (command === NOTE_ON && velocity === 0))
        latest.current.onNoteOff(note);
    };
    const attach = () => {
      if (!access) return;
      access.inputs.forEach((input) => {
        input.onmidimessage = onMessage;
      });
      setStatus(access.inputs.size ? 'ready' : 'no-devices');
    };

    navigator.requestMIDIAccess().then(
      (granted) => {
        if (cancelled) return;
        access = granted;
        access.onstatechange = attach;
        attach();
      },
      () => !cancelled && setStatus('denied'),
    );

    return () => {
      cancelled = true;
      if (!access) return;
      access.onstatechange = null;
      access.inputs.forEach((input) => {
        input.onmidimessage = null;
      });
    };
  }, []);

  return status;
}

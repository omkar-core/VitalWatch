import { NextResponse } from 'next/server';
import { sendWelcomeMessage, sendDeviceStatus, sendCalibrationGuide, sendTelegramMessage } from '@/lib/telegram';
import { triggerVitalsScanFromTelegram } from '@/app/actions';
import { getRows } from '@/lib/griddb-client';

const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// For the demo, we'll hard-code the mapping between the chatID and a patientId.
// This now aligns with the device ID from the ESP32 code.
const DEMO_PATIENT_ID = 'patient-01'; 

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Basic validation
    if (!body.message || !body.message.chat || !body.message.text) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const chatId = body.message.chat.id.toString();
    const command = body.message.text.trim();
    const userName = body.message.from.first_name || 'User';

    // IMPORTANT: For security, only process commands from the designated chat ID
    if (chatId !== TELEGRAM_CHAT_ID) {
        console.warn(`Unauthorized command from chatId: ${chatId}`);
        await sendTelegramMessage({ chatId, text: "You are not authorized to use this bot." });
        return NextResponse.json({ message: 'Unauthorized' });
    }

    switch (command) {
      case '/start':
      case '/help':
        await sendWelcomeMessage(chatId, userName);
        break;

      case '/vitals':
        // This triggers a long-running server action and returns immediately
        triggerVitalsScanFromTelegram(chatId, DEMO_PATIENT_ID);
        // We don't await it, so the webhook can respond to Telegram quickly.
        // The action will send progress messages itself.
        break;

      case '/status':
        const patientProfileResults = await getRows('patient_profiles', `patient_id='${DEMO_PATIENT_ID}'`);
        let patientProfile = null;
        if (patientProfileResults.results && patientProfileResults.results.length > 0) {
            const columns = patientProfileResults.columns;
            const values = patientProfileResults.results[0];
            patientProfile = columns.reduce((obj: any, col: any, index: number) => {
                obj[col.name] = values[index];
                return obj;
            }, {});
        }
        await sendDeviceStatus(chatId, patientProfile);
        break;
      
      case '/calibrate':
        await sendCalibrationGuide(chatId);
        break;

      default:
        await sendTelegramMessage({ chatId, text: `Unknown command: ${command}. Try /help for a list of commands.` });
        break;
    }

    return NextResponse.json({ message: 'Command received' });

  } catch (error: any) {
    console.error('[/api/telegram/webhook] Error:', error);
    // Try to inform the user if something goes wrong
    if (TELEGRAM_CHAT_ID) {
      await sendTelegramMessage({
        chatId: TELEGRAM_CHAT_ID,
        text: '❌ An internal error occurred while processing your command.',
      });
    }
    return NextResponse.json({ error: error.message || 'An internal server error occurred.' }, { status: 500 });
  }
}

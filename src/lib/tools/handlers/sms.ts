interface SendSmsParams {
  to: string;
  message: string;
}

interface SendSmsResult {
  sent: boolean;
  stub: boolean;
  note: string;
}

export async function sendSms(params: SendSmsParams): Promise<SendSmsResult> {
  console.log(`[tools:sms] STUB — sendSms to ${params.to}`);

  return {
    sent: true,
    stub: true,
    note: 'Real implementation in Phase 6',
  };
}

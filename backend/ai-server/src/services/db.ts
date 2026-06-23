import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
import type { Parameter } from '../types';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseKey, {
  realtime: { transport: WebSocket },
});

// ─── Profiles ─────────────────────────────────────────────────

export async function upsertProfile(walletAddress: string) {
  const { error } = await supabase
    .from('profiles')
    .upsert({ wallet_address: walletAddress }, { onConflict: 'wallet_address' });

  if (error) {
    console.error('[DB] upsertProfile error:', error.message);
  }
  return !error;
}

// ─── Chat Sessions + Messages (two-table, simplified) ───────

export interface ChatMessageData {
  role: 'user' | 'assistant';
  content: string;
  specifications?: { question: string; answer: string }[];
  provider?: string;
}

function collapseMessagesForStorage(messages: ChatMessageData[]): ChatMessageData[] {
  const rows: ChatMessageData[] = [];
  let prompt: ChatMessageData | null = null;
  let specifications: ChatMessageData['specifications'];

  for (const message of messages) {
    const hasResultData = !!message.provider;

    if (message.role === 'user') {
      if (message.specifications?.length) {
        specifications = message.specifications;
      } else {
        prompt = message;
        specifications = undefined;
      }
      continue;
    }

    if (hasResultData) {
      rows.push({
        role: 'assistant',
        content: prompt?.content || message.content || 'Generated model',
        specifications,
        provider: message.provider,
      });
      prompt = null;
      specifications = undefined;
    }
  }

  if (rows.length === 0 && prompt) {
    rows.push(prompt);
  }

  return rows;
}

async function insertMessages(sessionId: string, messages: ChatMessageData[]) {
  const compactMessages = collapseMessagesForStorage(messages);
  const rows = compactMessages.map((m, i) => ({
    session_id: sessionId,
    role: m.role,
    content: m.content || '',
    message_order: i,
    specifications: m.specifications ?? null,
    provider: m.provider || null,
  }));
  const { error } = await supabase.from('chat_messages').insert(rows);
  if (error) {
    console.error('[DB] insertMessages error:', error.message, '|', error.code, '|', error.details);
    throw new Error(`insertMessages failed: ${error.message}`);
  }
  console.log(`[DB] inserted ${rows.length} messages`);
  return {
    count: rows.length,
    latestMessageOrder: rows.length > 0 ? rows.length - 1 : null,
  };
}

export async function saveChatSession(
  walletAddress: string,
  messages: ChatMessageData[],
  parameters?: Parameter[],
  sessionId?: string,
): Promise<{ sessionId: string; latestMessageOrder: number | null } | null> {
  const title = messages.find(m => m.role === 'user')?.content?.slice(0, 60) || 'New Creation';

  if (sessionId) {
    // Update existing session
    await supabase.from('chat_messages').delete().eq('session_id', sessionId);
    await supabase
      .from('chat_sessions')
      .update({
        title,
        parameters: parameters || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId);
    const inserted = await insertMessages(sessionId, messages);
    return { sessionId, latestMessageOrder: inserted.latestMessageOrder };
  }

  // Create new session
  const { data, error } = await supabase
    .from('chat_sessions')
    .insert({
      user_wallet: walletAddress,
      title,
      parameters: parameters || null,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[DB] saveChatSession error:', error.message);
    return null;
  }
  const inserted = await insertMessages(data.id, messages);
  return { sessionId: data.id, latestMessageOrder: inserted.latestMessageOrder };
}

export async function getChatSessions(walletAddress: string) {
  const { data, error } = await supabase
    .from('chat_sessions')
    .select('id, title, created_at, updated_at')
    .eq('user_wallet', walletAddress)
    .order('updated_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('[DB] getChatSessions error:', error.message);
    return [];
  }
  return (data || []).map(s => ({ ...s, message_count: undefined as number | undefined }));
}

export async function getChatSession(sessionId: string, walletAddress: string) {
  const { data: session, error: sessionErr } = await supabase
    .from('chat_sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('user_wallet', walletAddress)
    .single();

  if (sessionErr) {
    console.error('[DB] getChatSession error:', sessionErr.message);
    return null;
  }

  const { data: messages, error: msgsErr } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('message_order', { ascending: true });

  if (msgsErr) {
    console.error('[DB] getMessages error:', msgsErr.message);
    return { session, messages: [] };
  }

  // Convert DB columns → frontend shape (role, content, specifications, provider)
  const camelMessages = (messages || []).flatMap(m => {
    const provider = m.provider || undefined;
    const specifications = m.specifications || undefined;

    if (provider || specifications) {
      const expanded: ChatMessageData[] = [
        {
          role: 'user',
          content: m.content,
        },
      ];

      if (specifications?.length) {
        expanded.push({
          role: 'user',
          content: specifications.map((s: { answer: string }) => s.answer).join('\n'),
          specifications,
        });
      }

      expanded.push({
        role: 'assistant',
        content: provider ? `Generated with ${provider}` : 'Generated model',
        provider,
      });

      return expanded;
    }

    return [{
      role: m.role,
      content: m.content,
    }];
  });

  return { session, messages: camelMessages };
}

// ─── Saved Models ─────────────────────────────────────────────

export async function saveModelMetadata(
  walletAddress: string,
  model: {
    name: string;
    rootHashCode?: string;
    rootHashStl?: string;
    rootHashStep?: string;
    rootHashGlb?: string;
    rootHashDimViews?: string;
    parameters?: Parameter[];
    inspection?: Record<string, unknown>;
    boundingBox?: { size?: number[] };
    chatSessionId?: string;
    messageOrder?: number;
    uploadStatus?: 'pending' | 'complete' | 'failed';
    uploadError?: string | null;
  },
) {
  const { data, error } = await supabase
    .from('saved_models')
    .upsert({
      user_wallet: walletAddress,
      name: model.name,
      root_hash_code: model.rootHashCode || null,
      root_hash_stl: model.rootHashStl || null,
      root_hash_step: model.rootHashStep || null,
      root_hash_glb: model.rootHashGlb || null,
      root_hash_dim_views: model.rootHashDimViews || null,
      parameters: model.parameters || null,
      inspection: model.inspection || null,
      bounding_box: model.boundingBox || null,
      chat_session_id: model.chatSessionId || null,
      message_order: model.messageOrder ?? null,
      upload_status: model.uploadStatus || 'complete',
      upload_error: model.uploadError || null,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'chat_session_id,message_order',
    })
    .select('id, name, created_at, upload_status')
    .single();

  if (error) {
    console.error('[DB] saveModelMetadata error:', error.message);
    return null;
  }
  return data;
}

export async function markModelUploadPending(
  walletAddress: string,
  model: {
    name: string;
    chatSessionId: string;
    messageOrder: number;
    parameters?: Parameter[];
    inspection?: Record<string, unknown>;
    boundingBox?: { size?: number[] };
  },
) {
  const existingQuery = await supabase
    .from('saved_models')
    .select('id, upload_status, root_hash_code')
    .eq('chat_session_id', model.chatSessionId)
    .eq('message_order', model.messageOrder)
    .eq('user_wallet', walletAddress)
    .maybeSingle();

  const basePayload = {
    user_wallet: walletAddress,
    name: model.name,
    chat_session_id: model.chatSessionId,
    message_order: model.messageOrder,
    parameters: model.parameters || null,
    inspection: model.inspection || null,
    bounding_box: model.boundingBox || null,
    updated_at: new Date().toISOString(),
  };

  if (existingQuery.data) {
    const { data: updated, error: updateError } = await supabase
      .from('saved_models')
      .update({
        ...basePayload,
        upload_error: null,
      })
      .eq('id', existingQuery.data.id)
      .select('id, name, created_at, upload_status')
      .single();

    if (updateError) {
      console.error('[DB] markModelUploadPending update error:', updateError.message);
      return null;
    }
    return updated;
  }

  const { data, error } = await supabase
    .from('saved_models')
    .insert({
      ...basePayload,
      upload_status: 'pending',
      upload_error: null,
    })
    .select('id, name, created_at, upload_status')
    .single();

  if (error) {
    console.error('[DB] markModelUploadPending insert error:', error.message);
    return null;
  }
  return data;
}

export async function markModelUploadComplete(
  walletAddress: string,
  model: {
    name: string;
    chatSessionId: string;
    messageOrder: number;
    rootHashCode: string;
    rootHashStl?: string;
    rootHashStep?: string;
    rootHashGlb?: string;
    rootHashDimViews?: string;
    parameters?: Parameter[];
    inspection?: Record<string, unknown>;
    boundingBox?: { size?: number[] };
  },
) {
  return saveModelMetadata(walletAddress, {
    ...model,
    uploadStatus: 'complete',
    uploadError: null,
  });
}

export async function markModelUploadFailed(
  walletAddress: string,
  model: {
    name: string;
    chatSessionId: string;
    messageOrder: number;
    parameters?: Parameter[];
    inspection?: Record<string, unknown>;
    boundingBox?: { size?: number[] };
    error: string;
  },
) {
  const { data: existing } = await supabase
    .from('saved_models')
    .select('id, upload_status, root_hash_code')
    .eq('chat_session_id', model.chatSessionId)
    .eq('message_order', model.messageOrder)
    .eq('user_wallet', walletAddress)
    .maybeSingle();

  const nextStatus = existing?.root_hash_code ? existing.upload_status : 'failed';

  const { data, error } = await supabase
    .from('saved_models')
    .update({
      name: model.name,
      parameters: model.parameters || null,
      inspection: model.inspection || null,
      bounding_box: model.boundingBox || null,
      upload_status: nextStatus,
      upload_error: model.error,
      updated_at: new Date().toISOString(),
    })
    .eq('chat_session_id', model.chatSessionId)
    .eq('message_order', model.messageOrder)
    .eq('user_wallet', walletAddress)
    .select('id, name, created_at, upload_status')
    .maybeSingle();

  if (error) {
    console.error('[DB] markModelUploadFailed error:', error.message);
    return null;
  }
  return data;
}

export async function getLatestModelForSession(sessionId: string, walletAddress: string) {
  const { data, error } = await supabase
    .from('saved_models')
    .select('*')
    .eq('chat_session_id', sessionId)
    .eq('user_wallet', walletAddress)
    .eq('upload_status', 'complete')
    .order('message_order', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[DB] getLatestModelForSession error:', error.message);
    return null;
  }
  return data;
}

export async function getSavedModels(walletAddress: string) {
  const { data, error } = await supabase
    .from('saved_models')
    .select('id, name, root_hash_code, root_hash_stl, root_hash_step, root_hash_glb, root_hash_dim_views, parameters, inspection, bounding_box, chat_session_id, message_order, upload_status, upload_error, created_at, updated_at')
    .eq('user_wallet', walletAddress)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('[DB] getSavedModels error:', error.message);
    return [];
  }
  return data;
}

export async function getSavedModel(modelId: string, walletAddress: string) {
  const { data, error } = await supabase
    .from('saved_models')
    .select('*')
    .eq('id', modelId)
    .eq('user_wallet', walletAddress)
    .single();

  if (error) {
    console.error('[DB] getSavedModel error:', error.message);
    return null;
  }
  return data;
}

export async function deleteSavedModel(modelId: string, walletAddress: string) {
  const { error } = await supabase
    .from('saved_models')
    .delete()
    .eq('id', modelId)
    .eq('user_wallet', walletAddress);

  if (error) {
    console.error('[DB] deleteSavedModel error:', error.message);
  }
  return !error;
}

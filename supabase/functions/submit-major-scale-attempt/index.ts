import {ScoringValidationError,scoreMajorScaleAttempt} from './scoring.mjs';

const corsHeaders={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'POST, OPTIONS'
};

function json(body:unknown,status=200){
  return new Response(JSON.stringify(body),{
    status,
    headers:{...corsHeaders,'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}
  });
}

function decodeJwtClaims(authorization:string|null){
  if(!authorization?.startsWith('Bearer ')) throw new Error('Authentication required');
  const token=authorization.slice(7).trim();
  const parts=token.split('.');
  if(parts.length!==3) throw new Error('Invalid access token');
  const payload=parts[1].replace(/-/g,'+').replace(/_/g,'/');
  const padded=payload+'='.repeat((4-payload.length%4)%4);
  const claims=JSON.parse(atob(padded));
  if(!claims?.sub || claims?.role!=='authenticated') throw new Error('Authenticated learner token required');
  return claims;
}

function requireUuid(value:unknown,name:string){
  const text=String(value||'');
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)){
    throw new ScoringValidationError(`${name} must be a UUID`);
  }
  return text;
}

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS') return new Response('ok',{headers:corsHeaders});
  if(req.method!=='POST') return json({error:'Method not allowed'},405);

  try{
    // Supabase gateway verifies the JWT because this function is deployed with verify_jwt=true.
    // Decoding here is only to obtain the already-verified subject for ownership checks in Postgres.
    const claims=decodeJwtClaims(req.headers.get('Authorization'));
    const body=await req.json();
    const practiceSessionId=requireUuid(body?.practice_session_id,'practice_session_id');
    const questionNumber=Number(body?.question_number);
    const itemCode=String(body?.item_code||'').trim();
    if(!Number.isInteger(questionNumber) || questionNumber<1){
      throw new ScoringValidationError('question_number must be a positive integer');
    }
    if(!itemCode) throw new ScoringValidationError('item_code is required');

    const scored=scoreMajorScaleAttempt(itemCode,body?.response_json);
    const supabaseUrl=Deno.env.get('SUPABASE_URL');
    const serviceRoleKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if(!supabaseUrl || !serviceRoleKey){
      console.error('Required Supabase function environment variables are unavailable');
      return json({error:'Server configuration error'},500);
    }

    const rpcResponse=await fetch(`${supabaseUrl}/rest/v1/rpc/persist_scored_major_scale_attempt`,{
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'apikey':serviceRoleKey,
        'Authorization':`Bearer ${serviceRoleKey}`
      },
      body:JSON.stringify({
        p_user_id:claims.sub,
        p_practice_session_id:practiceSessionId,
        p_question_number:questionNumber,
        p_item_code:itemCode,
        p_score:scored.score,
        p_response_json:body.response_json,
        p_skill_results:scored.skill_results
      })
    });

    const rpcBody=await rpcResponse.json().catch(()=>null);
    if(!rpcResponse.ok){
      const code=rpcBody?.code || null;
      const message=rpcBody?.message || 'Attempt could not be persisted';
      console.error('persist_scored_major_scale_attempt failed',code,message);
      const status=code==='42501'?403:code==='23505'?409:400;
      return json({error:message,code},status);
    }

    const persisted=Array.isArray(rpcBody)?rpcBody[0]:rpcBody;
    if(!persisted?.attempt_id){
      console.error('Attempt persistence returned no attempt_id');
      return json({error:'Attempt persistence returned no result'},500);
    }

    return json({
      attempt_id:persisted.attempt_id,
      score:Number(persisted.score),
      completed_questions:Number(persisted.completed_questions),
      skill_results:scored.skill_results,
      scoring_authority:'server'
    });
  }catch(error){
    if(error instanceof ScoringValidationError){
      return json({error:error.message},400);
    }
    console.error('submit-major-scale-attempt error',error);
    const message=error instanceof Error?error.message:'Unexpected server error';
    const status=/Authentication|access token|learner token/i.test(message)?401:500;
    return json({error:status===401?message:'Unexpected server error'},status);
  }
});

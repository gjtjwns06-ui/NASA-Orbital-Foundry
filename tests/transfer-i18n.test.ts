import {afterEach,describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {setLanguage} from '../src/i18n';
import {transferText} from '../src/transfer-i18n';
import {createDesign} from '../src/sim/catalog';
import {createTransferPlan,solveTransferPlan,createTransferRuntime,getTransferResult,evaluateEscapeStage} from '../src/transfer';

afterEach(()=>setLanguage('ko'));

describe('offline transfer diagnostics in English',()=>{
  it('leaves Korean mode, unknown diagnostics, identifiers and HTML escaping to their owners',()=>{
    const korean='지구에 완전히 수신된 고유 분광 자료 2/3개';
    expect(transferText(korean)).toBe(korean);
    setLanguage('en');
    for(const value of ['unknown diagnostic: 4.7 km/s','mars-spectrum:-12','<img src=x>','아직 등록되지 않은 진단'])expect(transferText(value)).toBe(value);
    expect(transferText('나의-관측: 화성 영향권 이탈 이후의 일정 구간은 임무 종료 시각에서 잘립니다.')).toBe('나의-관측: schedule portions after the Mars sphere-of-influence exit are clipped at mission end.');
    expect(transferText('나의-관측: 임무 종료 전에 남는 시간이 1초 미만이어서 이 작업은 실행하지 않습니다.')).toBe('나의-관측: this operation is skipped because less than 1 second remains before mission end.');
  });

  it('covers every static Korean diagnostic and label in the transfer domain source',()=>{
    setLanguage('en');const corpus=new Set<string>();
    for(const path of [...['runtime','planning','persistence','ephemeris','state'].map(file=>`src/transfer/${file}.ts`),'src/transfer.worker.ts']){
      const source=ts.createSourceFile(path,readFileSync(path,'utf8'),ts.ScriptTarget.ESNext,true);
      const visit=(node:ts.Node)=>{if(ts.isStringLiteralLike(node)&&/[가-힣]/.test(node.text))corpus.add(node.text);ts.forEachChild(node,visit);};visit(source);
    }
    expect(corpus.size).toBeGreaterThan(50);
    for(const source of corpus)expect(transferText(source),source).not.toMatch(/[가-힣]/);
  });

  it('preserves physical units, exact numeric strings and diagnostic paths',()=>{
    setLanguage('en');
    expect(transferText('정렬된 발사 단계가 3687 m/s 순간 탈출 기동을 수행하고 분리되었습니다. 단계 추진제 202.3 kg · 탐사선 추진제는 유지됩니다.')).toBe('The aligned launch stage performed an instantaneous 3687 m/s escape burn and separated. Stage propellant used: 202.3 kg · Spacecraft propellant is unchanged.');
    expect(transferText('탈출 단계 추진제가 13.7 kg 부족합니다. 발사 날짜 또는 단계를 바꾸세요.')).toBe('The escape stage is short of 13.7 kg of propellant. Change the departure date or stage.');
    expect(transferText('출발 평면 각 범위는 -3.141592653589793~3.141592653589793입니다.')).toBe('Departure plane angle must be within -3.141592653589793–3.141592653589793.');
    expect(transferText('작업 종료 범위는 1e-7~39312000입니다.')).toBe('Operation end must be within 1e-7–39312000.');
    expect(transferText('지구에 완전히 수신된 고유 분광 자료 2/3개')).toBe('Unique spectra fully received on Earth: 2/3');
    expect(transferText('임무 예산을 141.5 크레딧 초과합니다.')).toBe('Mission cost exceeds the budget by 141.5 credits.');
    expect(transferText('Error: 전이 저장 오류: runtime.packets[0].receivedBits 값이 재현 결과와 다릅니다.')).toBe('Error: Transfer save error: runtime.packets[0].receivedBits does not match the replayed value.');
    expect(transferText('전이 저장 오류: runtime.signals 목록이 재현 결과와 다릅니다.')).toBe('Transfer save error: runtime.signals does not match the replayed list.');
    expect(transferText('전이 저장 오류: sourceHashes 필드가 다릅니다.')).toBe('Transfer save error: sourceHashes has different fields.');
    expect(transferText('전이 저장 오류: 요청 시각 범위가 잘못됐습니다.')).toBe('Transfer save error: Requested timestamp is out of range.');
  });

  it('translates combined blocked-launch reasons without discarding one of the failures',()=>{
    setLanguage('en');const source='선택한 탈출 단계의 탑재 질량 한도를 초과합니다. 탈출 단계 추진제가 17.8 kg 부족합니다. 발사 날짜 또는 단계를 바꾸세요. 접은 탐사선이 탈출 단계의 탑재 페어링에 들어가지 않습니다. 임무 예산을 52 크레딧 초과합니다.';
    const result=transferText(source);expect(result).not.toMatch(/[가-힣]/);expect(result).toContain('17.8 kg');expect(result).toContain('52 credits');expect(result).toContain('payload fairing');expect(result).toContain('Payload mass');
  });

  it('translates actual launch events, outcome reasons and inherited spacecraft warnings without mutating them',()=>{
    setLanguage('en');const craft=createDesign('mars','balanced'),solution=solveTransferPlan(createTransferPlan()),state=createTransferRuntime(solution,craft);
    const before=JSON.stringify(state);for(const event of state.events)expect(transferText(event.message),event.code).not.toMatch(/[가-힣]/);
    for(const reason of getTransferResult(state).reasons)expect(transferText(reason),reason).not.toMatch(/[가-힣]/);
    expect(JSON.stringify(state)).toBe(before);
    craft.parts=craft.parts.filter(p=>!['solar','solarLarge','antenna','spectrometer'].includes(p.kind));
    const engine=craft.parts.find(p=>p.kind==='engine');if(engine){engine.face='px';engine.u=.8;engine.v=.8;}
    const warnings=evaluateEscapeStage(solution,craft).warnings;expect(warnings.length).toBeGreaterThanOrEqual(3);
    for(const warning of warnings)expect(transferText(warning.message),`${warning.code}: ${warning.message}`).not.toMatch(/[가-힣]/);
  });

  it('has readable labels for all emitted event codes and transfer-specific warning codes',()=>{
    setLanguage('en');for(const code of ['ESCAPE_BURN','LAUNCH_BLOCKED','DATA_RECEIVED','EARTH_EXIT','MARS_ENTRY','PERIAPSIS','MARS_EXIT','SAFE_MODE','RECOVERED','POWER_LOSS','SCIENCE_CAPTURED','SCHEDULE_CLIPPED','STAGE_PAYLOAD','STAGE_FUEL','STAGE_FAIRING','TRANSFER_BUDGET']){
      const output=transferText(code);expect(output).not.toBe(code);expect(output).not.toMatch(/[가-힣]/);
    }
  });
});

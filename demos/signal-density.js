/* signal-density — one rollout, two kinds of feedback: RL outcome advantage on every token vs on-policy distillation per-token teacher scores */
A.defineDemo('signal-density', function (mount) {
  const { bd } = A.demo(mount, '同一条回答，两种反馈：结果奖励 vs 老师逐 token 打分', '题目：3 个苹果每个 4 元，2 个梨每个 5 元，一共多少钱？（正确答案 22）；概率为示意');
  const EX = {
    wrong: { t: '中间算错，答案也错', toks: [['3', .9, .95], ['×', .8, .85], ['4', .95, .97], ['=', .9, .9], ['12', .9, .96], ['，', .7, .7], ['2', .85, .9], ['×', .8, .85], ['5', .95, .97], ['=', .9, .9], ['11', .55, .01], ['，', .7, .7], ['12', .8, .85], ['+', .8, .85], ['11', .9, .9], ['=', .9, .92], ['23', .85, .95], ['元', .9, .9], ['。', .9, .9]], R: 0 },
    lucky: { t: '中间算错，答案却对', toks: [['3', .9, .95], ['×', .8, .85], ['4', .95, .97], ['=', .9, .9], ['12', .9, .96], ['，', .7, .7], ['2', .85, .9], ['×', .8, .85], ['5', .95, .97], ['=', .9, .9], ['11', .55, .01], ['，', .7, .7], ['12', .8, .85], ['+', .8, .85], ['10', .3, .04], ['=', .9, .92], ['22', .8, .95], ['元', .9, .9], ['。', .9, .9]], R: 1 },
    right: { t: '全对', toks: [['3', .9, .95], ['×', .8, .85], ['4', .95, .97], ['=', .9, .9], ['12', .9, .96], ['，', .7, .7], ['2', .85, .9], ['×', .8, .85], ['5', .95, .97], ['=', .9, .9], ['10', .4, .97], ['，', .7, .7], ['12', .8, .85], ['+', .8, .85], ['10', .9, .95], ['=', .9, .92], ['22', .85, .97], ['元', .9, .9], ['。', .9, .9]], R: 1 },
  };
  let ex = 'wrong', mode = 'rl';
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  A.seg(ctl, Object.keys(EX).map((k) => ({ v: k, t: EX[k].t })), ex, (v) => { ex = v; draw(); }, '学生的回答');
  A.seg(ctl, [{ v: 'rl', t: '强化学习：结果奖励' }, { v: 'opd', t: '在线蒸馏：老师逐 token 打分' }], mode, (v) => { mode = v; draw(); }, '反馈方式');
  const row = A.el('div', { style: { margin: '10px 0', lineHeight: '3.2' } }); bd.append(row);
  const stats = A.el('div', { class: 'stats' }); bd.append(stats);
  const hint = A.el('p', { class: 'hint' }); bd.append(hint);
  function draw() {
    const E = EX[ex];
    const adv = E.R - 0.5;
    const sig = E.toks.map(([, ps, pt]) => (mode === 'rl' ? adv : Math.log(pt) - Math.log(ps)));
    row.innerHTML = E.toks.map(([w], i) => {
      const s = sig[i], c = A.div(A.clamp(s / 2, -1, 1));
      return `<span style="display:inline-flex;flex-direction:column;align-items:center;margin:0 2px;vertical-align:top"><span class="tok" style="background:${c};font-size:16px;min-width:22px;text-align:center">${w}</span><span class="mono" style="font-size:10.5px;line-height:1.2;color:var(--muted)">${(s >= 0 ? '+' : '') + s.toFixed(1)}</span></span>`;
    }).join('');
    const err = E.toks.findIndex(([w, ps, pt]) => pt < 0.1);
    stats.innerHTML = '';
    [['这条回答给出的反馈', mode === 'rl' ? '1 个数（整条回答一个优势值）' : E.toks.length + ' 个数（每个 token 一个）'], ['那个算错的 token 得到的信号', err >= 0 ? (sig[err] >= 0 ? '+' : '') + sig[err].toFixed(2) : '（没有算错的 token）'], ['正确步骤 “3×4=12” 得到的信号', (sig[4] >= 0 ? '+' : '') + sig[4].toFixed(2)]]
      .forEach(([k, v]) => stats.append(A.el('div', { class: 'stat' }, A.el('div', { class: 'k' }, k), A.el('div', { class: 'v', style: { fontSize: '16px' } }, v))));
    hint.innerHTML = mode === 'rl'
      ? `强化学习只看最终答案：答对奖励 1、答错 0，减去一组回答的平均分（这里取 0.5）得到优势 ${adv >= 0 ? '+' : ''}${adv.toFixed(1)}，<b>同一个数</b>加到每个 token 上。答错时，正确的 “3×4=12” 也一起被惩罚；“中间算错、答案却对”时，错误的 “2×5=11” 反而被奖励。只有在大量采样里平均之后，这些错误的功劳分配才会相互抵消，这就是 RL 样本效率低的原因。`
      : `在线蒸馏让学生自己生成回答，再由老师在<b>同样的前缀</b>下给每个 token 打分：信号 = log π<sub>老师</sub>(token) − log π<sub>学生</sub>(token)。正确的步骤得分接近 0（老师和学生看法一致），出错的 “11” 得到很大的负分，而且只有它。注意 “12 + 11 = 23” 在错误前缀下是算对了的，老师不会再惩罚它：问题被精确定位到出错的那一步。`;
  }
  draw();
});

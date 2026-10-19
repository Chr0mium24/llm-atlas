/* model-size — interactive demo (moved from ch09-quantization.html) */
A.defineDemo('model-size', function (mount) {
  const { FMT, encFloat, nearestE2M1, E2M1, NF4 } = A.num;
  const { bd } = A.demo(mount, '模型大小 × 量化格式 × 设备', '权重大小 + 约 15% 运行时与短上下文 KV');
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  const MODELS = [['Qwen3 8B', 8.2], ['Gemma 4 12B', 12], ['Qwen3.8 27B', 27], ['Llama 3 70B', 70.6], ['gpt-oss-120b', 117], ['DeepSeek V4-Flash', 284], ['Muse Spark Open', 816], ['DeepSeek V4-Pro', 1600], ['Kimi K3', 2800]];
  let P = 27;
  A.seg(ctl, MODELS.map(([n, p]) => ({ v: p, t: n })), P, (v) => { P = v; draw(); }, '模型（总参数）');
  const FM = [['BF16', 16], ['FP8 / Q8_0', 8.5], ['Q6_K', 6.56], ['Q4_K_M', 4.85], ['MXFP4', 4.25], ['Q3_K_M', 3.9], ['IQ2_XXS', 2.06], ['三值 PTQ1_0', 1.76], ['二值 Q1_0', 1.125]];
  const DEV = [['iPhone（8 GB，可用约 4）', 4], ['M3 MacBook 16 GB（可用约 11）', 11], ['RTX 4070 Ti 12 GB', 12], ['RTX 4090 24 GB', 24], ['H100 80 GB', 80], ['Mac Studio M3 Ultra 512 GB', 480], ['8×H100（640 GB）', 640], ['8×B200（1.5 TB）', 1536]];
  const out = A.el('div', { class: 'tablewrap' }); bd.append(out);
  function draw() {
    let h = '<table><tr><th>格式</th><th class="num">bpw</th><th class="num">占用</th>' + DEV.map(([n]) => `<th class="small" style="white-space:normal;min-width:70px">${n}</th>`).join('') + '</tr>';
    FM.forEach(([n, b]) => {
      const gb = (P * 1e9 * b) / 8 / 1e9 * 1.15;
      h += `<tr><td>${n}</td><td class="num">${b}</td><td class="num">${gb >= 1000 ? (gb / 1000).toFixed(2) + ' TB' : gb.toFixed(1) + ' GB'}</td>` + DEV.map(([, cap]) => (gb <= cap ? `<td class="fit" style="color:var(--good-ink)">✓ 可以</td>` : gb <= cap * 1.6 ? `<td class="fit" style="color:var(--s4)">△ 需卸载</td>` : `<td class="fit muted">✗ 放不下</td>`)).join('') + '</tr>';
    });
    out.innerHTML = h + '</table><p class="hint">“需卸载”= 超出不到 60%，可以把部分层或 MoE 专家放到 CPU 内存，速度会明显下降。这里只算权重；长上下文的 KV cache 要另算（' + A.cref('long-context') + '）。</p>';
  }
  draw();
});

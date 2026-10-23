export const COPY = {
  hero: {
    label: '一个无法打开的盒子',
    title: ['看不见它，', '但它会回应。'],
    intro: ['敲一敲、等一等、听一听。', '慢慢认识它留下的线索。'],
  },
  actions: {
    knock: { label: '敲两下', hover: '轻轻邀请它回答' },
    wait: { label: '等一会', hover: '把决定留给它' },
    touch: { label: '轻轻碰', hover: '只靠近，不催促' },
    listen: { label: '听听看', hover: '让回应慢慢浮上来' },
  },
  tabs: {
    box: { label: 'KNOCK KNOCK', title: '今天的盒子', copy: '轻轻互动，看看它会不会回应。' },
    evidence: { label: '留下的线索', title: '探索记录', copy: '每一次回应，都是认识它的一小步。' },
    island: { label: '远处的回声', title: '盒群岛', copy: '有些回应，会绕远路回来。' },
    profile: { label: '暂时的理解', title: '性格档案', copy: '根据相处留下的线索，慢慢形成的猜测。' },
  },
  state: {
    idle: { eyebrow: '此刻安静', title: '可以轻敲两下，或等一会儿。' },
    aware: { eyebrow: '正在等待', title: '这一次，由它决定何时回答。' },
    hesitating: { eyebrow: '收到敲击', title: '先留一点时间给它。' },
    approaching: { eyebrow: '感到靠近', title: '光正慢慢移向你的手。' },
    responding: { eyebrow: '刚刚回应', title: '这段回应已经记下来了。' },
    listening: { eyebrow: '正在聆听', title: '听听看，盒子里有什么回声。' },
  },
};

export const PERSONALITY_COPY = [
  ['companion', '陪伴型', '它会在你停下来时留下来。'],
  ['explorer', '探索型', '它对新的靠近保持一点好奇。'],
  ['nocturnal', '夜行型', '夜晚的回应通常更慢，也更清楚。'],
  ['calm', '安静型', '它不急着回答，但很少真正离开。'],
  ['curious', '好奇', '这是目前的猜测，还会继续变化。'],
  ['shy', '害羞？', '靠近之前，它会先退开一点点。'],
];


export const COPY = {
  hero: {
    label: 'ROBOT WITH CARE · 不可见的陪伴',
    title: ['看不见它，', '但它会回应。'],
    intro: ['敲两下，等一会儿，或靠近一点听。', '每一次轻微回应，都会留下一点线索。'],
  },
  actions: {
    knock: { label: '敲两下', hover: '轻敲一下，是一次邀请。' },
    wait: { label: '等一会儿', hover: '陪它等一会儿。' },
    touch: { label: '轻轻碰', hover: '靠近一点，它会回应。' },
    listen: { label: '听听看', hover: '听听它的动静。' },
  },
  tabs: {
    box: '今天的盒子',
    evidence: '记录',
    island: '盒群岛',
    profile: '性格',
  },
  state: {
    idle: { eyebrow: '此刻安静', title: '敲两下，看看它会不会回应。' },
    aware: { eyebrow: '留一点时间', title: '让它自己决定什么时候回答。' },
    hesitating: { eyebrow: '听见敲击', title: '它停了一下。' },
    approaching: { eyebrow: '正在靠近', title: '光正在靠近你的手边。' },
    responding: { eyebrow: '刚刚回应', title: '你们多了一个可以记住的片刻。' },
    listening: { eyebrow: '安静聆听', title: '听听它的动静。' },
  },
};

export const PERSONALITY_COPY = [
  ['companion', '陪伴型', '你停下来时，它愿意多留一会儿。'],
  ['explorer', '探索型', '新的靠近，会让它多看一眼。'],
  ['nocturnal', '偏夜行', '夜晚的回应更慢，也更容易被听见。'],
  ['calm', '安静型', '它不急着回答，安静也算一种相处。'],
  ['curious', '好奇', '它会留意环境变化，再决定要不要靠近。'],
  ['shy', '慢热', '靠近之前，它常常先停一停。'],
];


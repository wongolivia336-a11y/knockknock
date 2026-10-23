export const COPY = {
  hero: {
    label: 'ROBOT WITH CARE · 薛定谔的宠物',
    title: ['看不见它，', '陪伴仍会发生。'],
    intro: ['敲击、触摸、等待或倾听。', '光、声音与细微动作，都是它的回答。'],
  },
  actions: {
    knock: { label: '敲两下', hover: '两下轻敲，是一次邀请。' },
    wait: { label: '等一会儿', hover: '把一点时间留给它。' },
    touch: { label: '轻轻碰', hover: '它先停一下，再慢慢靠近。' },
    listen: { label: '听听看', hover: '安静一点，听听细微的动静。' },
  },
  tabs: {
    box: { label: '照料与回应', title: '今天的盒子', copy: '从一次轻敲开始，用日常相处慢慢建立熟悉。' },
    evidence: { label: '相处留下的线索', title: '探索记录', copy: '记录光、声音、触摸与停留，不替它下结论。' },
    island: { label: '声音明信片', title: '盒群岛', copy: '把一段轻声寄出去，回信会在某个时候抵达。' },
    profile: { label: '暂时的理解', title: '性格档案', copy: '性格来自反复相处的观察，只是一种行为联想。' },
  },
  state: {
    idle: { eyebrow: '此刻安静', title: '可以轻敲两下发出邀请，也可以再陪它安静一会儿。' },
    aware: { eyebrow: '留一点时间', title: '这一次，让它自己决定什么时候回答。' },
    hesitating: { eyebrow: '听见敲击', title: '它停了一下。回应不必马上发生。' },
    approaching: { eyebrow: '正在靠近', title: '光朝你的手边，慢慢挪近了一点。' },
    responding: { eyebrow: '刚刚回应', title: '你们之间，多了一个可以记住的片刻。' },
    listening: { eyebrow: '安静聆听', title: '听听细微的动静，也给沉默留一点位置。' },
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


import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import cloud from 'd3-cloud';
import '../styles/WordCloud.css';

// props로 onWordClick 함수를 전달받도록 수정
export default function AnimatedWordCloud({ onWordClick }) {
  const svgRef = useRef(null);
  const [wordsData, setWordsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isPaused, setIsPaused] = useState(false);
  const animationRef = useRef(null);
  const isPausedRef = useRef(false);

  useEffect(() => {
    const fetchWordCloudData = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('http://localhost:5000/api/wordcloud/today');
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        let data = await res.json();
        if (!Array.isArray(data)) {
            throw new Error("Received data is not an array.");
        }

        // 단어 수를 40개로 제한
        const slicedData = data.slice(0, 40);

        // 글자 크기를 위한 스케일 설정
        const sizeScale = d3.scaleLinear()
          .domain([d3.min(slicedData, d => d.value) || 1, d3.max(slicedData, d => d.value) || 10])
          .range([15, 60]); // 최소/최대 글자 크기

        const transformed = slicedData.map(({ text, value }) => ({
          text: text || '',
          size: sizeScale(value), // 스케일을 사용하여 글자 크기 결정
          value: value,
          x: 0,
          y: 0,
          color: `hsl(${Math.random() * 360}, 70%, 50%)`,
          dx: (Math.random() * 2 - 1) * (value / 20),
          dy: (Math.random() * 2 - 1) * (value / 20),
          rotation: 0,
        }));
        setWordsData(transformed);
      } catch (err) {
        console.error('워드클라우드 데이터 로드 실패:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchWordCloudData();
  }, []);

  useEffect(() => {
    if (!wordsData.length || loading || error) return;

    const width = 1000;
    const height = 800;

    // 중복 렌더링 방지를 위해 기존 요소 제거
    d3.select(svgRef.current).selectAll("*").remove();

    const layout = cloud()
      .size([width, height])
      .words(wordsData.map(d => ({ text: d.text, size: d.size })))
      .padding(5)
      .rotate(() => 0)
      .font('Impact')
      .fontSize(d => d.size)
      .on('end', draw)
      .start();

    function draw(words) {
      const svg = d3.select(svgRef.current)
        .attr('width', width)
        .attr('height', height)
        .append('g')
        .attr('transform', `translate(${width / 2},${height / 2})`);

      words.forEach((word, i) => {
        // words 배열에 있는 단어와 wordsData를 text 기준으로 매칭합니다.
        const originalWordData = wordsData.find(w => w.text === word.text);
        if (!originalWordData) return;

        originalWordData.x = word.x;
        originalWordData.y = word.y;
        originalWordData.rotation = word.rotate;

        svg.append('text')
        .attr('class', `word-${originalWordData.text.replace(/[^a-zA-Z0-9]/g, '-')}`)
        .attr('text-anchor', 'middle')
        .style('font-size', `${word.size}px`)
        .style('fill', originalWordData.color)
        .style('cursor', 'pointer')
        .style('pointer-events', 'all')
        .attr('transform', `translate(${word.x}, ${word.y})rotate(${word.rotate})`)
        .text(word.text)
        .on('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            console.log("클릭 확인:", word.text);
            if (onWordClick) {
                onWordClick(word.text);
            }
        });
      });

      animateWords();
    }

    function animateWords() {
      const amplitude = 15;
      const speed = 0.0001;

      function tick() {
        if (!isPausedRef.current) {
          wordsData.forEach((w) => {
            w.x += w.dx * 0.2;
            w.y += w.dy * 0.2;

            // 벽에 부딪히면 방향 전환
            if (Math.abs(w.x) > (width / 2) - w.size) w.dx *= -1;
            if (Math.abs(w.y) > (height / 2) - w.size) w.dy *= -1;
            
            const offsetX = Math.sin(Date.now() * speed + wordsData.indexOf(w)) * amplitude;
            const offsetY = Math.cos(Date.now() * speed + wordsData.indexOf(w)) * amplitude;
            
            d3.select(`.word-${w.text.replace(/[^a-zA-Z0-9]/g, '-')}`)
              .attr('transform', `translate(${w.x + offsetX}, ${w.y + offsetY})rotate(${w.rotation})`);
          });
        }

        animationRef.current = requestAnimationFrame(tick);
      }
      tick();
    }
  }, [wordsData, onWordClick, loading, error]);

  // 컴포넌트 언마운트 시 애니메이션 정리
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  const toggleAnimation = () => {
    setIsPaused(!isPaused);
    isPausedRef.current = !isPaused;
  };

  if (loading) {
    return <div className="wordcloud-wrapper">데이터를 불러오는 중입니다...</div>;
  }

  if (error) {
    return <div className="wordcloud-wrapper">오류가 발생했습니다: {error}</div>;
  }

  return (
    <div className="wordcloud-wrapper">
      <button 
        className="animation-control-btn" 
        onClick={toggleAnimation}
        title={isPaused ? "움직임 재생" : "움직임 정지"}
      >
        {isPaused ? '▶ 재생' : '⏸ 정지'}
      </button>
      <svg ref={svgRef}></svg>
    </div>
  );
}
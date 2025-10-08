import React, { useState, forwardRef, useImperativeHandle } from 'react';
import { Modal } from 'antd';
import { motion } from 'framer-motion';

const allCards = [
    // SSR (10%)
    { id: 5, image: '/manuals/assets/3d_game.jpg', title: '3D Game Creation', description: 'Create 3D worlds and games', rarity: 'SSR' },
    // SR (60%)
    { id: 1, image: '/manuals/assets/game_maker_show.jpg', title: 'Game Creation', description: 'Create engaging games with AI', rarity: 'SR' },
    { id: 2, image: '/manuals/assets/web_dev.jpg', title: 'Web Development', description: 'Build websites on your phone', rarity: 'SR' },
    { id: 4, image: '/manuals/assets/video_processing.jpg', title: 'Video Processing', description: 'Edit videos with AI assistance', rarity: 'SR' },
    { id: 6, image: '/manuals/assets/floating_and_attach.jpg', title: 'Floating Window & Attach', description: 'Access AI features anytime', rarity: 'SR' },
    { id: 7, image: '/manuals/assets/package_list.jpg', title: 'Package Management', description: 'Powerful plugin ecosystem', rarity: 'SR' },
    { id: 8, image: '/manuals/assets/set_alarm_and_date.jpg', title: 'Device Automation', description: 'Control your device with commands', rarity: 'SR' },
    // R (30%)
    { id: 3, image: '/manuals/assets/app_packaging.jpg', title: 'App Packaging', description: 'Package your creations', rarity: 'R' },
    { id: 9, image: '/manuals/assets/game_maker_chat.jpg', title: 'AI Chat', description: 'Converse with your AI partner', rarity: 'R' },
    { id: 10, image: '/manuals/assets/user_step/step_for_frist_3.jpg', title: 'User Preference', description: 'Customize the AI to understand you', rarity: 'R' }
];

interface Card {
  id: number;
  image: string;
  title: string;
  description: string;
  rarity: 'SSR' | 'SR' | 'R';
}

let lastDrawnCards: Card[] = [];

export interface GachaGalleryRef {
  draw: () => void;
}

const GachaGallery: React.ForwardRefRenderFunction<GachaGalleryRef, { darkMode: boolean }> = ({ darkMode }, ref) => {
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [drawnCards, setDrawnCards] = useState<Card[]>([]);

    const drawRandomCards = () => {
        let newDrawnCards;
        let isSameAsLast;

        do {
            let availableCards = [...allCards];
            newDrawnCards = [];
            const rarityProbs = { SSR: 0.1, SR: 0.6, R: 0.3 };

            for (let i = 0; i < 3; i++) {
                if (availableCards.length === 0) break;

                let selectedCard = null;
                while (selectedCard === null) {
                    const rand = Math.random();
                    let chosenRarity: 'SSR' | 'SR' | 'R';

                    if (rand < rarityProbs.SSR) {
                        chosenRarity = 'SSR';
                    } else if (rand < rarityProbs.SSR + rarityProbs.SR) {
                        chosenRarity = 'SR';
                    } else {
                        chosenRarity = 'R';
                    }

                    const potentialCards = availableCards.filter(c => c.rarity === chosenRarity);
                    if (potentialCards.length > 0) {
                        const cardIndex = Math.floor(Math.random() * potentialCards.length);
                        selectedCard = potentialCards[cardIndex];
                    }
                }
                
                newDrawnCards.push(selectedCard);
                availableCards = availableCards.filter(c => c.id !== selectedCard!.id);
            }

            const drawnIds = newDrawnCards.map(c => c.id).sort().join(',');
            const lastIds = lastDrawnCards.map(c => c.id).sort().join(',');
            isSameAsLast = newDrawnCards.length < 3 ? false : (drawnIds === lastIds);

        } while (isSameAsLast);

        lastDrawnCards = newDrawnCards;
        setDrawnCards(newDrawnCards);
        setIsModalVisible(true);
    };

    useImperativeHandle(ref, () => ({
      draw: drawRandomCards,
    }));

    return (
        <div style={{ textAlign: 'center', padding: '60px 24px' }}>
            <style>
                {`
                    .gacha-modal .ant-modal-content {
                        background: transparent;
                        box-shadow: none;
                    }
                    .gacha-modal .ant-modal-body {
                        padding: 0;
                    }
                    .gacha-modal .ant-modal-close {
                        color: white;
                        top: 24px;
                        right: 24px;
                    }
                    .drawn-card-item {
                        width: 280px;
                        height: 400px;
                        background-color: ${darkMode ? '#1f2937' : '#fff'};
                        border-radius: 15px;
                        box-shadow: 0 10px 30px rgba(0,0,0,0.3);
                        position: relative;
                        overflow: hidden;
                        transition: transform 0.2s ease-out;
                    }
                    .drawn-card-item:hover {
                        transform: translateY(-5px);
                    }
                    .drawn-card-img {
                        width: 100%;
                        height: 100%;
                        object-fit: cover;
                    }
                    .drawn-card-text {
                        position: absolute;
                        bottom: 0;
                        left: 0;
                        width: 100%;
                        padding: 1.2rem;
                        background: linear-gradient(to top, rgba(0,0,0,0.8), transparent);
                        text-align: left;
                    }
                    .drawn-card-text h4 {
                        margin: 0 0 0.5rem 0;
                        font-size: 1.2rem;
                        color: white;
                    }
                    .drawn-card-text p {
                        margin: 0;
                        font-size: 0.9rem;
                        color: #e0e0e0;
                    }
                    .rarity-badge {
                        position: absolute;
                        top: 10px;
                        right: 10px;
                        padding: 5px 10px;
                        font-size: 0.9rem;
                        font-weight: bold;
                        color: white;
                        border-radius: 5px;
                        z-index: 10;
                        text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
                    }
                    @keyframes pulse-ssr {
                        0% { box-shadow: 0 0 20px #fbbf24; }
                        50% { box-shadow: 0 0 35px #fde68a; }
                        100% { box-shadow: 0 0 20px #fbbf24; }
                    }
                    .rarity-SSR {
                        background: linear-gradient(135deg, #f59e0b, #d97706);
                        box-shadow: 0 0 20px #fbbf24;
                        animation: pulse-ssr 2s infinite;
                    }
                    .rarity-SR {
                        background: linear-gradient(135deg, #8b5cf6, #6d28d9);
                        box-shadow: 0 0 15px #a78bfa;
                    }
                    .rarity-R {
                        background: linear-gradient(135deg, #6b7280, #4b5563);
                        box-shadow: 0 0 10px #9ca3af;
                    }
                `}
            </style>

            <Modal
                open={isModalVisible}
                onCancel={() => setIsModalVisible(false)}
                footer={null}
                width="auto"
                centered
                className="gacha-modal"
                styles={{ body: { background: 'transparent' } }}
            >
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '2rem', padding: '2rem' }}>
                    {drawnCards.map((card, index) => (
                        <motion.div
                            key={card.id}
                            initial={{ opacity: 0, y: 50 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: index * 0.2 }}
                        >
                            <div className="drawn-card-item">
                                <div className={`rarity-badge rarity-${card.rarity}`}>{card.rarity}</div>
                                <img src={card.image} alt={card.title} className="drawn-card-img" />
                                <div className="drawn-card-text">
                                    <h4>{card.title}</h4>
                                    <p>{card.description}</p>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </Modal>
        </div>
    );
};

export default forwardRef(GachaGallery); 
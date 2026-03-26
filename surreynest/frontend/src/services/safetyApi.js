import api from './api';

export const getSafetyIntelligence = async (postcode) => {
    const response = await api.get('/api/safety/intelligence', {
        params: { postcode }
    });
    return response.data;
};

export const getGuildfordSafetyOverview = async () => {
    const response = await api.get('/api/safety/guildford-overview');
    return response.data;
};

export const getSafetyRankings = async () => {
    const response = await api.get('/api/safety/rankings');
    return response.data;
};

export const getSafetyMap = async (postcode) => {
    const response = await api.get('/api/safety/map', {
        params: { postcode }
    });
    return response.data;
};

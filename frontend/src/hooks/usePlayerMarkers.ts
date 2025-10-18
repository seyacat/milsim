import { useState, useCallback, useEffect, useRef } from 'react';
import { Game, Player, TeamColor } from '../types';
import * as L from 'leaflet';

interface UsePlayerMarkersProps {
  game: Game | null;
  map: L.Map | null;
  currentUser: any;
  socket: any;
  isOwner: boolean;
}

export const usePlayerMarkers = ({ game, map, currentUser, socket, isOwner }: UsePlayerMarkersProps) => {
  
  const [playerMarkers, setPlayerMarkers] = useState<Map<number, L.Marker>>(new Map());
  const [userMarker, setUserMarker] = useState<L.Marker | null>(null);
  const playerMarkersRef = useRef<Map<number, L.Marker>>(new Map());

  // Create player marker icon
  const createPlayerMarkerIcon = useCallback((team: TeamColor, isUser: boolean = false) => {
    const className = isUser ? 'user-marker' : 'player-marker';


    return L.divIcon({
      className: `${className} ${team}`,
      html: '', // Empty HTML - CSS will handle the styling
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });
  }, []);

  // Create user marker
  const createUserMarker = useCallback((lat: number, lng: number) => {
    if (!map) return;

    // Remove existing user marker
    if (userMarker) {
      map.removeLayer(userMarker);
    }

    const currentPlayer = game?.players?.find(p => p.user?.id === currentUser?.id);
    const team = currentPlayer?.team || 'none';
    
    const icon = createPlayerMarkerIcon(team, true);

    const marker = L.marker([lat, lng], { icon }).addTo(map);
    
    // Create popup with custom class for positioning
    const popup = L.popup({
      className: 'user-marker-popup'
    }).setContent('<strong>Tú.</strong>');
    
    marker.bindPopup(popup);
    
    setUserMarker(marker);
    return marker;
  }, [map, game, currentUser, createPlayerMarkerIcon, userMarker]);

  // Update player markers
  const updatePlayerMarkers = useCallback(() => {
    if (!map || !game || !currentUser) return;


    // Clear existing markers (except user's own marker)
    playerMarkersRef.current.forEach((marker, playerId) => {
      if (playerId !== currentUser.id && marker) {
        map.removeLayer(marker);
      }
    });

    // Keep only user's own marker
    const userMarkerId = currentUser.id;
    if (playerMarkersRef.current.has(userMarkerId)) {
      const tempMarker = playerMarkersRef.current.get(userMarkerId);
      playerMarkersRef.current.clear();
      if (tempMarker) {
        playerMarkersRef.current.set(userMarkerId, tempMarker);
      }
    } else {
      playerMarkersRef.current.clear();
    }

    // Check if we have valid game and players data
    if (!game.players || !Array.isArray(game.players)) {
      return;
    }

    // Add markers for all players (will be updated with real positions via WebSocket)
    game.players.forEach(player => {
      // Skip if player data is incomplete or it's the current user
      if (!player || !player.user || !player.user.id || player.user.id === currentUser.id) {
        return;
      }

      // Check visibility rules
      const isStopped = game.status === 'stopped';
      const currentPlayer = game.players?.find(p => p.user?.id === currentUser.id);
      
      // Owner can always see all players
      if (!isOwner) {
        // For non-owners, check team visibility rules
        if (!isStopped) {
          // In running/paused state, only show same team players
          if (!currentPlayer || !player || currentPlayer.team !== player.team) {
            return; // Skip creating marker for this player
          }
        }
        // In stopped state, all players can see each other
      }

      // Create initial marker at default position (will be updated when position data arrives)
      const targetIsOwner = game.owner && player.user && player.user.id === game.owner.id;
      const team = player.team || 'none';
      
      const icon = createPlayerMarkerIcon(team, false);
      
      const marker = L.marker([0, 0], { icon }).addTo(map);
      
      const teamInfo = team && team !== 'none' ? `<br>Equipo: ${team.toUpperCase()}` : '';
      
      marker.bindPopup(`
        <strong>${player.user?.name || 'Jugador'}</strong><br>
        ${targetIsOwner ? 'Propietario' : 'Jugador'}${teamInfo}<br>
        <em>Esperando posición GPS...</em>
      `);
      
      if (player.user && player.user.id) {
        playerMarkersRef.current.set(player.user.id, marker);
      }
    });

    setPlayerMarkers(new Map(playerMarkersRef.current));
  }, [map, game, currentUser, isOwner, createPlayerMarkerIcon]);

  // Update individual player marker with real position data
  const updatePlayerMarker = useCallback((positionData: {
    userId: number;
    userName: string;
    lat: number;
    lng: number;
    accuracy: number;
  }) => {
    const { userId, userName, lat, lng, accuracy } = positionData;
    
    if (!map || !game || !currentUser) return;
    
    // Skip if it's the current user
    if (userId === currentUser.id) {
      return;
    }

    // Check if current user should see this player's position
    const isStopped = game.status === 'stopped';
    
    // Owner can always see all players
    if (!isOwner) {
      // For non-owners, check team visibility rules
      const currentPlayer = game.players?.find(p => p.user?.id === currentUser.id);
      const targetPlayer = game.players?.find(p => p.user?.id === userId);
      
      if (!isStopped) {
        // In running/paused state, only show same team players
        if (!currentPlayer || !targetPlayer || currentPlayer.team !== targetPlayer.team) {
          // Remove marker if it exists and shouldn't be visible
          const existingMarker = playerMarkersRef.current.get(userId);
          if (existingMarker) {
            map.removeLayer(existingMarker);
            playerMarkersRef.current.delete(userId);
          }
          return;
        }
      }
      // In stopped state, all players can see each other
    }

    let marker = playerMarkersRef.current.get(userId);
    const targetPlayer = game.players?.find(p => p.user?.id === userId);
    
    if (!marker) {
      // Create new marker if it doesn't exist
      const targetIsOwner = game.owner && userId === game.owner.id;
      const team = targetPlayer?.team || 'none';
      const icon = createPlayerMarkerIcon(team, false);
      
      marker = L.marker([lat, lng], { icon }).addTo(map);
      playerMarkersRef.current.set(userId, marker);
    } else {
      // Update existing marker position
      marker.setLatLng([lat, lng]);
    }
    
    // Store accuracy for popup info only
    (marker as any).accuracy = accuracy;
    
    // Update popup with position info
    const targetIsOwner = game.owner && userId === game.owner.id;
    const teamInfo = targetPlayer?.team && targetPlayer.team !== 'none' ? `<br>Equipo: ${targetPlayer.team.toUpperCase()}` : '';
    
    marker.bindPopup(`
      <strong>${userName || 'Jugador'}</strong><br>
      ${targetIsOwner ? 'Propietario' : 'Jugador'}${teamInfo}<br>
      <small>Precisión: ${Math.round(accuracy)}m</small>
    `);

    setPlayerMarkers(new Map(playerMarkersRef.current));
  }, [map, game, currentUser, isOwner, createPlayerMarkerIcon]);

  // Update user marker team
  const updateUserMarkerTeam = useCallback(() => {
    if (!userMarker || !map) return;

    const currentPosition = userMarker.getLatLng();
    createUserMarker(currentPosition.lat, currentPosition.lng);
  }, [userMarker, map, createUserMarker]);

  // Update player marker with new team
  const updatePlayerMarkerTeam = useCallback((playerId: number, team: TeamColor) => {
    
    // Find the player by playerId to get the userId
    const targetPlayer = game?.players?.find(p => p.id === playerId);
    if (!targetPlayer) {
      // Also try to find by userId if playerId doesn't match
      const playerByUserId = game?.players?.find(p => p.user?.id === playerId);
      if (!playerByUserId) {
        return;
      }
      return updatePlayerMarkerTeamByUserId(playerByUserId.user.id, team);
    }
    
    const userId = targetPlayer?.user?.id;
    if (!userId) {
      return;
    }

    updatePlayerMarkerTeamByUserId(userId, team);
  }, [map, game, createPlayerMarkerIcon]);

  // Update player marker with new team by userId
  const updatePlayerMarkerTeamByUserId = useCallback((userId: number, team: TeamColor) => {
    const marker = playerMarkersRef.current.get(userId);
    if (marker) {
      // Update the existing marker's icon instead of recreating it
      const newIcon = createPlayerMarkerIcon(team, false);
      marker.setIcon(newIcon);
      
      // Update popup with current info
      const targetPlayer = game?.players?.find(p => p.user?.id === userId);
      const targetIsOwner = game?.owner && userId === game.owner.id;
      const teamInfo = team && team !== 'none' ? `<br>Equipo: ${team.toUpperCase()}` : '';
      const currentAccuracy = (marker as any).accuracy || 0;
      
      marker.bindPopup(`
        <strong>${targetPlayer?.user?.name || 'Jugador'}</strong><br>
        ${targetIsOwner ? 'Propietario' : 'Jugador'}${teamInfo}<br>
        <small>Precisión: ${Math.round(currentAccuracy)}m</small>
      `);
      
      setPlayerMarkers(new Map(playerMarkersRef.current));
    } else {
      // No existing marker found for this user
    }
  }, [map, game, createPlayerMarkerIcon]);

  // Listen for WebSocket events
  useEffect(() => {
    if (!socket) return;

    const handlePositionUpdate = (data: any) => {
      console.log(`[PLAYER_MARKERS] Received position update: ${data.action} for user ${data.data.userId}`);
      if (data.action === 'positionUpdate' && data.data.userId !== currentUser?.id) {
        console.log(`[PLAYER_MARKERS] Updating marker for player ${data.data.userId} at ${data.data.lat}, ${data.data.lng}`);
        updatePlayerMarker(data.data);
      }
    };

    const handlePlayerTeamUpdated = (data: any) => {
      if (data.action === 'playerTeamUpdated') {
        updatePlayerMarkerTeam(data.data.playerId, data.data.team);
      }
    };

    // Listen for game updates that might include player team changes
    const handleGameUpdate = (data: any) => {
      if (data.game && data.game.players) {
        // Update all player markers when game data changes
        updatePlayerMarkers();
      }
    };

    // Listen for player positions response (for owner view)
    const handlePlayerPositionsResponse = (data: any) => {
      if (data.action === 'playerPositionsResponse' && data.data.positions) {
        console.log(`[PLAYER_MARKERS] Received player positions response with ${data.data.positions.length} positions`);
        data.data.positions.forEach((position: any) => {
          updatePlayerMarker(position);
        });
      }
    };

    // Handle player inactive notifications
    const handlePlayerInactive = (data: any) => {
      if (data.action === 'playerInactive') {
        console.log(`[PLAYER_MARKERS] Player ${data.data.userId} marked as inactive`);
        removePlayerMarker(data.data.userId);
      }
    };

    socket.on('gameAction', handlePositionUpdate);
    socket.on('gameAction', handlePlayerTeamUpdated);
    socket.on('gameUpdate', handleGameUpdate);
    socket.on('gameAction', handlePlayerPositionsResponse);
    socket.on('gameAction', handlePlayerInactive);

    return () => {
      socket.off('gameAction', handlePositionUpdate);
      socket.off('gameAction', handlePlayerTeamUpdated);
      socket.off('gameUpdate', handleGameUpdate);
      socket.off('gameAction', handlePlayerPositionsResponse);
      socket.off('gameAction', handlePlayerInactive);
    };
  }, [socket, currentUser, updatePlayerMarker, updatePlayerMarkerTeam, updatePlayerMarkers]);

  // Update markers when game changes
  useEffect(() => {
    updatePlayerMarkers();
  }, [game, currentUser, updatePlayerMarkers]);

  // Remove player marker from map
  const removePlayerMarker = useCallback((userId: number) => {
    if (!map) return;
    
    const marker = playerMarkersRef.current.get(userId);
    if (marker) {
      map.removeLayer(marker);
      playerMarkersRef.current.delete(userId);
      setPlayerMarkers(new Map(playerMarkersRef.current));
    }
  }, [map]);

  return {
    playerMarkers: playerMarkersRef.current,
    userMarker,
    updatePlayerMarkers,
    updatePlayerMarker,
    updateUserMarkerTeam,
    updatePlayerMarkerTeam,
    updatePlayerMarkerTeamByUserId,
    createUserMarker,
    removePlayerMarker
  };
};
//select-leagues/page.tsx
'use client';
import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from '@hello-pangea/dnd';

import axios from 'axios';

type League = { league_id: string; name: string };

export default function SelectLeagues() {
  const [leagueSize, setLeagueSize] = useState(12);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [sideA, setSideA] = useState<League[]>([]);
  const [sideB, setSideB] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams();
  const router = useRouter();
  const username = searchParams.get('username');

  useEffect(() => {
    const fetchLeagues = async () => {
      try {
        const res = await axios.get(`/api/leagues?username=${username}`);
        setLeagues(res.data);
        setLoading(false);
      } catch (err) {
        console.error(err);
      }
    };
    fetchLeagues();
  }, [username]);

  const getList = (id: string) => {
    if (id === 'all') return leagues;
    if (id === 'a') return sideA;
    if (id === 'b') return sideB;
    return [];
  };

  const updateList = (id: string, newList: League[]) => {
    if (id === 'all') setLeagues([...newList]);
    if (id === 'a') setSideA([...newList]);
    if (id === 'b') setSideB([...newList]);
  };

  const handleDrag = (result: DropResult) => {
  if (!result.destination) return;

  const sourceId = result.source.droppableId;
  const destId = result.destination.droppableId;

  if (sourceId === destId) {
    const items = Array.from(getList(sourceId));
    const [moved] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, moved);
    updateList(sourceId, items);
  } else {
    const sourceItems = Array.from(getList(sourceId));
    const destItems = Array.from(getList(destId));
    const [moved] = sourceItems.splice(result.source.index, 1);
    destItems.splice(result.destination.index, 0, moved);
    updateList(sourceId, sourceItems);
    updateList(destId, destItems);
  }
};


  const handleCompare = () => {
    const query = new URLSearchParams({
      a: sideA.map((l) => l.league_id).join(','),
      b: sideB.map((l) => l.league_id).join(','),
      username: username || '',
      size: leagueSize.toString(),
    }).toString();
    router.push(`/compare?${query}`);
  };

  return (
    <div className="min-h-screen p-4 bg-gray-50">
      <h1 className="text-2xl font-bold mb-6 text-center">Drag & Drop Leagues</h1>
      <div className="text-center mb-4">
        <label className="mr-2 font-medium">League Size:</label>
        <select
          className="border rounded px-2 py-1"
          value={leagueSize}
          onChange={(e) => setLeagueSize(Number(e.target.value))}
        >
          {[8, 10, 12, 14, 16].map((size) => (
            <option key={size} value={size}>{size}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-center">Loading leagues for {username}...</p>
      ) : (
        <>
          <DragDropContext onDragEnd={handleDrag}>
            <div className="grid grid-cols-3 gap-4">
              {[
                { id: 'all', title: 'All Leagues', data: leagues },
                { id: 'a', title: 'Side A', data: sideA },
                { id: 'b', title: 'Side B', data: sideB }
              ].map(({ id, title, data }) => (
                <Droppable droppableId={id} key={id}>
                  {(provided) => (
                    <div
                      className="bg-white rounded p-4 shadow min-h-[300px]"
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                    >
                      <h2 className="font-semibold mb-2">{title}</h2>
                      {data.map((league, index) => (
                        <Draggable
                          key={league.league_id}
                          draggableId={league.league_id.toString()}
                          index={index}
                        >
                          {(provided) => (
                            <div
                              className="bg-blue-100 rounded p-2 mb-2"
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                            >
                              {league.name}
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              ))}
            </div>
          </DragDropContext>
          <div className="text-center mt-6">
            <button
              onClick={handleCompare}
              disabled={sideA.length === 0 || sideB.length === 0}
              className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 disabled:bg-gray-400"
            >
              Compare ADPs
            </button>
          </div>
        </>
      )}
    </div>
  );
}

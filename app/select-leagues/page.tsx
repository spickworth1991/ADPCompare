
'use client';
import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import axios from 'axios';

type League = { league_id: string; name: string };

export default function SelectLeagues() {
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

  const handleDrag = (result: DropResult) => {
    if (!result.destination) return;
    const sourceList = getList(result.source.droppableId);
    const destList = getList(result.destination.droppableId);
    const [moved] = sourceList.splice(result.source.index, 1);
    destList.splice(result.destination.index, 0, moved);
    updateList(result.source.droppableId, sourceList);
    updateList(result.destination.droppableId, destList);
  };

  const getList = (id: string) => (id === 'all' ? [...leagues] : id === 'a' ? [...sideA] : [...sideB]);
  const updateList = (id: string, newList: League[]) => {
    if (id === 'all') setLeagues(newList);
    if (id === 'a') setSideA(newList);
    if (id === 'b') setSideB(newList);
  };

  const handleCompare = () => {
    const query = new URLSearchParams({
      a: sideA.map((l) => l.league_id).join(','),
      b: sideB.map((l) => l.league_id).join(','),
      username: username || '',
    }).toString();
    router.push(`/compare?${query}`);
  };

  return (
    <div className="min-h-screen p-4 bg-gray-50">
      <h1 className="text-2xl font-bold mb-6 text-center">Drag & Drop Leagues</h1>
      {loading ? (
        <p className="text-center">Loading leagues for {username}...</p>
      ) : (
        <>
          <DragDropContext onDragEnd={handleDrag}>
            <div className="grid grid-cols-3 gap-4">
              {[{ id: 'all', title: 'All Leagues', data: leagues }, { id: 'a', title: 'Side A', data: sideA }, { id: 'b', title: 'Side B', data: sideB }].map(({ id, title, data }) => (
                <Droppable key={id} droppableId={id}>
                  {(provided) => (
                    <div className="bg-white rounded p-4 shadow min-h-[300px]" ref={provided.innerRef} {...provided.droppableProps}>
                      <h2 className="font-semibold mb-2">{title}</h2>
                      {data.map((league, index) => (
                        <Draggable draggableId={league.league_id} index={index} key={league.league_id}>
                          {(provided) => (
                            <div className="bg-blue-100 rounded p-2 mb-2" ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}>
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
            <button onClick={handleCompare} disabled={sideA.length === 0 || sideB.length === 0} className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 disabled:bg-gray-400">
              Compare ADPs
            </button>
          </div>
        </>
      )}
    </div>
  );
}

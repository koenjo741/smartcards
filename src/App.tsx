import { useState, useCallback } from 'react';
import { useStore } from './hooks/useStore';
import { Layout } from './components/Layout';
import { CardModal } from './components/CardModal';
import { ProjectModal } from './components/ProjectModal';
import { CardForm } from './components/CardForm';
// import { Plus, Download, Loader2 } from 'lucide-react'; // Removed unused icons
import type { Card, Project } from './types';
import clsx from 'clsx';

import { SortAsc, Calendar } from 'lucide-react';
import { useGoogleCalendar } from './hooks/useGoogleCalendar';
import { useAppSync } from './hooks/useAppSync';
import { DROPBOX_APP_KEY } from './hooks/useDropbox';
import { getPreviewText } from './utils/helpers';
import { Header } from './components/Header';
import { EmptyState } from './components/EmptyState';
import { SettingsModal } from './components/SettingsModal';
import { TimelineView } from './components/TimelineView';
import { ConfirmModal } from './components/ConfirmModal';
import { useEffect } from 'react';



type SortOption = 'alpha' | 'date';

import { matchesSearch } from './utils/search';

// ... (existing imports)

function App() {
  const { projects, cards, addProject, addCard, updateCard, deleteCard, reorderProjects, updateProject, deleteProject, loadData: loadDataStore, customColors, setCustomColors } = useStore();
  const { createEvent, deleteEvent, updateEvent, isAuthenticated: isGoogleAuthenticated } = useGoogleCalendar();
  // ... (lines 80-203 untouched in this replace, need to ensure context match)
  // Actually, I cannot easily replace specific non-contiguous lines without MultiReplace or careful scoping.
  // Let's do it in two steps or use MultiReplace.
  // Better yet, I will use MultiReplace to fix both the declaration and the usage site.

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [sortOption, setSortOption] = useState<SortOption>('date');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState(''); // New Search State
  const [viewMode, setViewMode] = useState<'list' | 'timeline'>('list');
  const [googleSyncStatus, setGoogleSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error' | 'deleted'>('idle');

  // Confirmation State
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    isDestructive?: boolean;
    confirmText?: string;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => { },
  });

  // PWA Install Prompt State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);

  // Check if running in standalone mode
  useEffect(() => {
    const checkStandalone = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true;
      setIsStandalone(isStandalone);
    };
    checkStandalone();
    window.addEventListener('resize', checkStandalone); // Sometimes changes on rotation/resize
    return () => window.removeEventListener('resize', checkStandalone);
  }, []);

  // Catch PWA Install Prompt
  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } else {
      // Fallback instructions
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
      const isDesktop = /Windows|Macintosh|Linux/.test(navigator.userAgent);

      if (isIOS) {
        alert("To install on iOS:\n1. Tap the Share button (square with arrow)\n2. Scroll down and tap 'Add to Home Screen'");
      } else if (isDesktop) {
        alert("App Install:\nPlease look for the 'Install' icon ⊕ or ⬇ in your browser's address bar (right side).");
      } else {
        alert("To install:\nTap your browser menu (three dots) and select 'Add to Home Screen' or 'Install App'");
      }
    }
  };

  const handleCalendarToggle = async (e: React.MouseEvent, card: Card) => {
    e.stopPropagation(); // Prevent card selection

    if (card.googleEventId) {
      setConfirmState({
        isOpen: true,
        title: 'Delete from Google Calendar?',
        message: 'Möchtest du diesen Termin aus dem Google Kalender löschen?',
        confirmText: 'Löschen',
        isDestructive: true,
        onConfirm: async () => {
          // Pass the stored calendarId (or undefined, which defaults to 'primary')
          const success = await deleteEvent(card.googleEventId!, card.googleCalendarId);
          if (success) {
            const updatedCard = { ...card, googleEventId: undefined, googleCalendarId: undefined };
            updateCard(updatedCard);
            // CRITICAL FIX: Update editingCard if it matches, to prevent CardForm from having stale data (and re-adding without ID)
            if (editingCard?.id === card.id) {
              // Preserve local changes if any? No, CardForm handles "initialData" updates by resetting.
              // Ideally we should merge? But simplest is to just update.
              // Note: If user has unsaved text changes, this might overwrite them if we just replace editingCard.
              // But handleCalendarToggle usually happens from the LIST view.
              // If it happens from list view while card is open, we MUST update editingCard.
              setEditingCard(updatedCard);
            }
          }
        }
      });
    } else {
      if (!card.dueDate) {
        alert('Bitte lege zuerst ein Fälligkeitsdatum fest.');
        return;
      }

      const result = await createEvent(card);
      if (result) {
        const updatedCard = {
          ...card,
          googleEventId: result.eventId,
          googleCalendarId: result.calendarId
        };
        updateCard(updatedCard);
        // CRITICAL FIX: Update editingCard if it matches
        if (editingCard?.id === card.id) {
          setEditingCard(updatedCard);
        }
      }
    }
  };

  // Dropbox integration via hook
  const {
    isDropboxAuthenticated,
    isAuthChecking,
    isCloudLoaded,
    isSyncing,
    connectionError,
    connect,
    disconnect,
    saveData,
    loadData,
    deleteFile,
    lastSynced,
    userName,
    isCloudSynced
  } = useAppSync();

  // Auto-initialize TODO Project and Card (Keep in App.tsx for now or move to useAppSync? 
  // It uses addProject/addCard which are from store. 
  // It's business logic. Lets keep it here or move to a useInitTodos hook.
  // For clarity, let's keep it here but simplified.)

  // 3. Auto-initialize TODO Project and Card
  useEffect(() => {
    if (!projects || !cards) return; // Wait for data load
    if (!isCloudLoaded) return; // CRITICAL: Wait until cloud sync is done before creating new cards to avoid duplicates/overwrites

    const todoProjectName = 'TODO';
    let todoProject = projects.find(p => p.name === todoProjectName);
    let todoCard = cards.find(c => todoProject && c.projectIds.includes(todoProject.id));

    const today = new Date();
    const dateStr = `📅 ${today.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}`;

    if (!todoProject) {
      // Create Project if missing
      const newProjectId = crypto.randomUUID();
      addProject({ id: newProjectId, name: todoProjectName, color: '#f59e0b' });
    } else if (!todoCard) {
      // Create Card ONLY if really missing
      const newCardId = crypto.randomUUID();
      addCard({
        id: newCardId,
        title: dateStr,
        content: '',
        projectIds: [todoProject.id],
      });
    } else {
      // Update Title if date changed
      if (todoCard.title !== dateStr) {
        updateCard({ ...todoCard, title: dateStr });
      }
    }
  }, [projects, cards, isCloudLoaded, addProject, addCard, updateCard]);

  // Sync logic moved to useAppSync


  const handleDropboxLoad = async () => {
    const data = await loadData();
    if (data && data.projects && data.cards) {
      loadDataStore(data);
      setIsSettingsOpen(false);
    }
  };

  const handleConnect = () => {
    if (DROPBOX_APP_KEY.includes('ENTER_YOUR')) {
      alert('Missing Dropbox App Key. Please enter it in src/hooks/useDropbox.ts');
      return;
    }
    connect();
  };

  const handleOpenNewProject = () => {
    setEditingProject(null);
    setIsProjectModalOpen(true);
  };

  const handleOpenEditProject = (project: Project) => {
    setEditingProject(project);
    setIsProjectModalOpen(true);
  };

  const handleSaveProject = (projectData: Omit<Project, 'id'> | Project) => {
    if ('id' in projectData) {
      updateProject(projectData as Project);
    } else {
      addProject({
        ...projectData,
        id: crypto.randomUUID(),
      } as Project);
    }
    setIsProjectModalOpen(false);
  };

  const handleOpenNewCard = () => {
    setEditingCard(null);
    setIsModalOpen(true);
  };

  const handleCardClick = (card: Card) => {
    setExpandedCardId(card.id);
    setEditingCard(card);
    setViewMode('list'); // Switch back to detail view on selection
  };

  const handleCloseExpanded = () => {
    setExpandedCardId(null);
    setEditingCard(null);
  };

  const handleProjectSelect = (projectId: string | null) => {
    setSelectedProjectId(projectId);

    // Filter to see how many cards are "visible" for this project
    const visibleCards = cards.filter(card => {
      // 1. Must belong to project (if one is selected)
      if (projectId && !card.projectIds.includes(projectId)) return false;
      // 2. Must match current search
      if (!matchesSearch(card, searchQuery)) return false;
      return true;
    });

    // Auto-open if exactly one card is visible
    // (This generalizes the previous 'TODO' logic)
    if (visibleCards.length === 1) {
      const card = visibleCards[0];
      setExpandedCardId(card.id);
      setEditingCard(card);
    } else {
      // Otherwise close detail view
      handleCloseExpanded();
    }
  };

  const handleSaveCard = useCallback(async (cardData: Omit<Card, 'id'> | Card) => {
    // console.log("App: handleSaveCard called", cardData.title);
    if ('id' in cardData && (cardData as Card).id) {
      let dataToSave = { ...(cardData as Card) };

      // Defensive Fix: Check if googleEventId is being accidentally dropped while dueDate exists
      // This happens if CardForm's local initialData is stale or logic fails
      const existingCard = cards.find(c => c.id === dataToSave.id);
      if (existingCard?.googleEventId && dataToSave.dueDate && !dataToSave.googleEventId) {
        console.warn("App: Restoring Google Event ID lost in update payload", {
          existing: existingCard.googleEventId,
          incoming: dataToSave.googleEventId
        });
        dataToSave.googleEventId = existingCard.googleEventId;
        dataToSave.googleCalendarId = existingCard.googleCalendarId;
      }

      updateCard(dataToSave);
      if (expandedCardId === dataToSave.id) {
        setEditingCard(dataToSave);
      }

      // Auto-Sync to Google Calendar if event exists
      // Note: We use existingCard here (pre-update) (store state)
      if (existingCard?.googleEventId) {
        // CASE 1: Date Removed -> Delete Event
        if (!cardData.dueDate && existingCard.dueDate) {
          console.log("App: Due date removed, deleting Google Calendar event...");
          setGoogleSyncStatus('syncing');
          try {
            const success = await deleteEvent(existingCard.googleEventId, existingCard.googleCalendarId);
            if (success) {
              setGoogleSyncStatus('deleted');
              // Explicitly ensure the card is updated to remove the ID (if not already done by updateCard logic)
              // updateCard(cardData) above should have sent { ...card, dueDate: '' }.
              // But we want to ensure googleEventId is cleared in store if logic elsewhere preserved it.
              // The Defensive Fix below ensures we KEEP it if dueDate exists.
              // If dueDate is gone, we let it go.
              // Just to be safe/clean:
              updateCard({ ...(cardData as Card), googleEventId: undefined, googleCalendarId: undefined });

              setTimeout(() => setGoogleSyncStatus('idle'), 4000);
            } else {
              setGoogleSyncStatus('error');
            }
          } catch (err) {
            console.error("App: Delete failed", err);
            setGoogleSyncStatus('error');
          }
        }
        // CASE 2: Update Event
        else {
          // Only update if relevant fields changed
          const hasChanged =
            existingCard.title !== cardData.title ||
            existingCard.content !== cardData.content ||
            existingCard.dueDate !== cardData.dueDate;

          // DEBUGGING: Check why sync might be skipped
          /*
          console.log("App: handleSaveCard check", {
              existingId: existingCard?.googleEventId,
              cardId: (cardData as Card).id,
              hasChanged,
              isDelete: !cardData.dueDate
          });
          */

          if (hasChanged && cardData.dueDate) {
            console.log("App: Changes detected, attempting sync...");

            // Attempt update. ensureAuth() inside will check connection.
            // We use 'await' but we don't block the UI update above, 
            // though strict consistency might prefer waiting.
            // For better UX (speed), we let UI update first.

            setGoogleSyncStatus('syncing');
            const success = await updateEvent(cardData as Card, existingCard.googleEventId, existingCard.googleCalendarId);
            if (success) {
              setGoogleSyncStatus('success');
              setTimeout(() => setGoogleSyncStatus('idle'), 3000); // Clear success message after 3s
            } else {
              setGoogleSyncStatus('error');
            }
          } else {
            // console.log("App: No relevant changes for Google Calendar");
          }
        }
      } else {
        // console.log("App: No Google Event ID found for card", existingCard?.title);
      }
    } else {
      const newId = crypto.randomUUID();
      const newCard = { ...cardData, id: newId } as Card;
      addCard(newCard);
      setIsModalOpen(false);
    }
  }, [updateCard, addCard, expandedCardId, cards, updateEvent]);

  const handleDeleteCard = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();

    // Find card to check for attachments/calendar events
    const cardToDelete = cards.find(c => c.id === id);
    if (!cardToDelete) return;

    const hasAttachments = cardToDelete.attachments && cardToDelete.attachments.length > 0;
    const confirmMessage = hasAttachments
      ? 'Achtung: Mit dem Löschen dieser Card löschen Sie auch die angehängten Attachments!'
      : 'Delete this card?';

    setConfirmState({
      isOpen: true,
      title: 'Delete Card',
      message: confirmMessage,
      confirmText: 'Delete Forever',
      isDestructive: true,
      onConfirm: async () => {
        // 1. Delete Attachments from Dropbox
        if (hasAttachments) {
          for (const attachment of cardToDelete.attachments!) {
            await deleteFile(attachment.path);
          }
        }

        // 2. Delete Google Calendar Event
        if (cardToDelete.googleEventId) {
          await deleteEvent(cardToDelete.googleEventId, cardToDelete.googleCalendarId);
        }

        // 3. Delete from Local Store
        deleteCard(id);

        if (expandedCardId === id) {
          handleCloseExpanded();
        }
      }
    });
  };

  const getDueDateStyle = (dateString: string) => {
    if (!dateString) return undefined;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let target: Date;
    // Robust parsing: Handle ISO strings and YYYY-MM-DD
    if (dateString.includes('T')) {
      target = new Date(dateString);
    } else {
      const [year, month, day] = dateString.split('-').map(Number);
      target = new Date(year, month - 1, day);
    }
    target.setHours(0, 0, 0, 0);

    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffTime < 0) return '#ee4444'; // < Today (Overdue)
    if (diffTime === 0) return '#2563eb'; // == Today
    if (diffDays >= 1 && diffDays <= 7) return '#f59e10'; // Next 7 days (Today+1 ... Today+7)
    return undefined; // Default (> Today+7)
  };

  const formatDueDate = (dateString: string) => {
    if (!dateString) return '';
    let date: Date;

    if (dateString.includes('T')) {
      date = new Date(dateString);
    } else {
      const [year, month, day] = dateString.split('-').map(Number);
      date = new Date(year, month - 1, day);
    }

    const dayStr = date.getDate().toString().padStart(2, '0');
    const monthStr = (date.getMonth() + 1).toString().padStart(2, '0');
    const yearStr = date.getFullYear(); // Full Year
    return `${dayStr}.${monthStr}.${yearStr}`;
  };

  const filteredCards = (selectedProjectId
    ? cards.filter(card => card.projectIds.includes(selectedProjectId))
    : cards)
    .filter(card => matchesSearch(card, searchQuery)) // Apply search filter
    .sort((a, b) => {
      if (sortOption === 'alpha') {
        return (a.title || '').localeCompare(b.title || '');
      } else {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }
    });

  const selectedProject = projects.find(p => p.id === selectedProjectId);

  // Separate TODO card from list for logic
  const todoProject = projects.find(p => p.name === 'TODO');
  const todoCard = todoProject ? cards.find(c => c.projectIds.includes(todoProject.id)) : null;

  // Filter TODO card out of standard list
  // CHANGED: We now only filter out the specific pinned TODO card.
  // If other cards were accidentally assigned to the TODO project (the bug),
  // they will now appear in the list so the user can open them and fix them.
  const standardCards = filteredCards.filter(c => !todoCard || c.id !== todoCard.id);

  if (isAuthChecking) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!isDropboxAuthenticated) {
    return <EmptyState onConnect={handleConnect} />;
  }

  // FORCE SYNC WAIT: Block UI until data is loaded from Cloud
  if (isDropboxAuthenticated && !isCloudLoaded) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 text-white">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          <p className="text-gray-400 font-medium">Syncing with Cloud...</p>
        </div>
      </div>
    );
  }

  return (
    <Layout
      projects={projects}
      onAddProject={handleOpenNewProject}
      selectedProjectId={selectedProjectId}
      onSelectProject={handleProjectSelect}
      onEditProject={handleOpenEditProject}
      onOpenSettings={() => setIsSettingsOpen(true)}
      connectionError={connectionError}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      currentView={viewMode}
      onViewChange={setViewMode}
    >
      <CardModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        projects={projects}
        onSave={handleSaveCard}
        cards={cards}
        googleSyncStatus={googleSyncStatus}
      />


      {/* ... Header ... */}
      <Header
        selectedProject={selectedProject}
        connectionError={connectionError}
        isSyncing={isSyncing}
        isGoogleAuthenticated={isGoogleAuthenticated}
        isStandalone={isStandalone}
        onInstallClick={handleInstallClick}
        onOpenNewCard={handleOpenNewCard}
        expandedCardId={expandedCardId}
      />

      {/* Persistent 3-Column Layout */}
      <div className="flex flex-col md:flex-row flex-1 min-h-0 gap-6 overflow-hidden">
        {/* Middle Column: Card List (30% or fixed width) */}
        <div className={clsx(
          "w-full md:w-[30%] md:min-w-[300px] flex flex-col border-gray-700 md:border-r bg-slate-900 rounded-lg p-4 h-full",
          expandedCardId ? "hidden md:flex" : "flex"
        )}>
          {/* Sort Controls */}
          <div className="flex space-x-2 mb-4">
            {/* ... Buttons ... */}
            <button
              onClick={() => setSortOption('alpha')}
              className={clsx(
                "flex-1 flex items-center justify-center space-x-2 py-1.5 rounded text-xs font-medium transition-colors border",
                sortOption === 'alpha'
                  ? "bg-blue-600 text-white border-blue-500"
                  : "bg-slate-800 text-gray-400 border-gray-700 hover:bg-slate-700 hover:text-gray-200"
              )}
              title="Sort Alphabetically"
            >
              <SortAsc className="w-3 h-3" />
              <span>A-Z</span>
            </button>
            <button
              onClick={() => setSortOption('date')}
              className={clsx(
                "flex-1 flex items-center justify-center space-x-2 py-1.5 rounded text-xs font-medium transition-colors border",
                sortOption === 'date'
                  ? "bg-blue-600 text-white border-blue-500"
                  : "bg-slate-800 text-gray-400 border-gray-700 hover:bg-slate-700 hover:text-gray-200"
              )}
              title="Sort by Due Date (Earliest first)"
            >
              <Calendar className="w-3 h-3" />
              <span>Due Date</span>
            </button>
          </div>

          <div className="overflow-y-auto space-y-3 flex-1 scrollbar-thin scrollbar-thumb-gray-600 pr-2 pb-20 md:pb-0">
            {/* PINNED TODO CARD */}
            {todoCard && (
              <div
                key={todoCard.id}
                onClick={() => handleCardClick(todoCard)}
                className={clsx(
                  "p-4 rounded-lg cursor-pointer transition-all border group mb-4", // Added mb-4 for separator
                  todoCard.id === expandedCardId
                    ? "bg-amber-950/30 border-amber-500 shadow-md ring-1 ring-amber-500"
                    : "bg-amber-950/10 border-amber-500/50 hover:bg-amber-900/20 hover:border-amber-500 shadow-sm"
                )}
              >
                <div className="flex justify-between items-start mb-1">
                  <h4 className={clsx("font-bold text-base truncate pr-2 text-amber-500")}>
                    {todoCard.title}
                  </h4>
                  <span className="text-[10px] uppercase tracking-wider text-amber-500 font-medium border border-amber-500/30 px-1.5 py-0.5 rounded">
                    TODO
                  </span>
                </div>
                {/* Preview text removed for TODO card as requested */}
              </div>
            )}

            {standardCards.length === 0 ? (
              <div className="text-gray-400 text-center py-8 italic">
                {todoCard ? '' : 'No other cards found.'}
              </div>
            ) : (
              standardCards.map(card => {
                const dateColor = card.dueDate ? getDueDateStyle(card.dueDate) : undefined;
                return (
                  <div
                    key={card.id}
                    onClick={() => handleCardClick(card)}
                    className={clsx(
                      "p-4 rounded-lg cursor-pointer transition-all border group",
                      card.id === expandedCardId
                        ? "bg-slate-800 border-blue-500 shadow-md ring-1 ring-blue-500"
                        : "bg-slate-800 border-gray-700 hover:bg-slate-700 hover:border-gray-600 shadow-sm"
                    )}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <h4 className={clsx("font-medium text-base truncate pr-2 flex-1", card.id === expandedCardId ? "text-blue-400" : "text-gray-100")}>
                        {card.title || <span className="text-gray-500 italic">Untitled</span>}
                      </h4>
                      {card.dueDate && (
                        <div
                          onClick={(e) => handleCalendarToggle(e, card)}
                          className="flex items-center space-x-1.5 px-1.5 py-0.5 rounded hover:bg-slate-600 transition-colors cursor-pointer group/date"
                          title={card.googleEventId ? "Aus Google Kalender löschen" : "In Google Kalender eintragen"}
                        >
                          <span className={clsx(
                            "text-[10px] font-bold transition-all duration-300",
                            card.googleEventId ? "text-blue-400 opacity-100 scale-100" : "text-gray-600 opacity-0 group-hover/date:opacity-50 scale-0 group-hover/date:scale-100 w-0 group-hover/date:w-auto"
                          )}>
                            G
                          </span>
                          <span
                            className="text-xs font-mono whitespace-nowrap"
                            style={{ color: dateColor }}
                          >
                            <span className={clsx(!dateColor && "text-gray-400")}>
                              {formatDueDate(card.dueDate)}
                            </span>
                          </span>
                        </div>
                      )}
                    </div>


                    <p className="text-gray-400 text-xs line-clamp-2 mb-2">
                      {getPreviewText(card.content)}
                    </p>

                    <div className="flex justify-between items-center">
                      <div className="flex gap-1">
                        {projects.filter(p => card.projectIds.includes(p.id)).map(p => (
                          <div key={p.id} className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} title={p.name} />
                        ))}
                      </div>
                      <button
                        onClick={(e) => handleDeleteCard(e, card.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-gray-500 hover:text-red-400 transition-opacity"
                        title="Delete card"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Detail View (70%) */}
        {/* Logic: Hidden on mobile IF no card is expanded */}
        <div className={clsx(
          "w-full md:flex-1 bg-slate-800 rounded-xl shadow-lg border border-gray-700 p-4 md:p-8 overflow-y-auto relative h-full",
          !expandedCardId && viewMode === 'list' ? "hidden md:block" : "block",
          viewMode === 'timeline' ? "p-0 overflow-hidden" : ""
        )}>
          {viewMode === 'timeline' ? (
            <TimelineView
              cards={cards} // Pass all cards, TimelineView filters by date
              projects={projects}
              onCardClick={handleCardClick}
            />
          ) : (
            expandedCardId && editingCard ? (
              <>
                {/* Mobile Back Button */}
                <div className="md:hidden flex justify-end mb-4">
                  <button
                    onClick={handleCloseExpanded}
                    className="flex items-center text-blue-400 font-bold hover:text-blue-300 transition-colors"
                  >
                    <span className="mr-1">←</span> Back to List
                  </button>
                </div>
                <CardForm
                  key={editingCard.id} // Force remount on card switch to ensure form resets
                  initialData={editingCard}
                  projects={projects}
                  cards={cards} // Pass cards for linking
                  onSelectCard={handleCardClick} // Enable navigation
                  onSave={handleSaveCard}
                  onCancel={handleCloseExpanded} // Acts as "close card" (clears selection)
                  className="text-gray-100" // Pass text color to form
                  customColors={customColors}
                  onUpdateCustomColors={setCustomColors}
                  isCloudSynced={isCloudSynced}
                  isSyncing={isSyncing}
                  googleSyncStatus={googleSyncStatus}
                />
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-gray-400">
                <div className="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <p className="text-lg font-medium">Select a card to view details</p>
                <p className="text-sm mt-1">or create a new one</p>
              </div>
            )
          )}
        </div>
      </div>

      <CardModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveCard}
        projects={projects}
        cards={cards} // Pass cards for linking
        initialData={null}
      />

      <ProjectModal
        isOpen={isProjectModalOpen}
        onClose={() => setIsProjectModalOpen(false)}
        onSave={handleSaveProject}
        initialData={editingProject}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        isAuthenticated={isDropboxAuthenticated}
        userName={userName}
        isSyncing={isSyncing}
        lastSynced={lastSynced}
        onConnect={handleConnect}
        onDisconnect={disconnect}
        onSave={() => saveData({ projects, cards, customColors })}
        onLoad={handleDropboxLoad}

        // Project Management
        projects={projects}
        onReorderProjects={reorderProjects}
        onDeleteProject={deleteProject}
      />

      <ConfirmModal
        isOpen={confirmState.isOpen}
        onClose={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmState.onConfirm}
        title={confirmState.title}
        message={confirmState.message}
        confirmText={confirmState.confirmText}
        isDestructive={confirmState.isDestructive}
      />
    </Layout>
  );
}

export default App;

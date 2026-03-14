import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Plus, 
  Calendar as CalendarIcon,
  CheckCircle2,
  ListTodo,
  Download,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useAppointments, type Appointment } from "@/hooks/useAppointments";
import { useTasks, type Task } from "@/hooks/useTasks";
import { AppointmentForm } from "@/components/schedule/AppointmentForm";
import { downloadIcs } from "@/lib/icsExport";
import { TaskForm } from "@/components/schedule/TaskForm";
import { AppointmentCard } from "@/components/schedule/AppointmentCard";
import { TaskCard } from "@/components/schedule/TaskCard";
import { ScheduleVisits } from "@/components/schedule/ScheduleVisits";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function Schedule() {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [appointmentFormOpen, setAppointmentFormOpen] = useState(false);
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteType, setDeleteType] = useState<'appointment' | 'task'>('appointment');

  const {
    appointments,
    getAppointmentsByDate,
    datesWithAppointments,
    toggleComplete: toggleAppointmentComplete,
    deleteAppointment,
  } = useAppointments();

  const {
    pendingTasks,
    completedTasks,
    toggleComplete: toggleTaskComplete,
    deleteTask,
  } = useTasks();

  const selectedDateAppointments = date ? getAppointmentsByDate(date) : [];

  const handleEditAppointment = (appointment: Appointment) => {
    setEditingAppointment(appointment);
    setAppointmentFormOpen(true);
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setTaskFormOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (deleteId) {
      if (deleteType === 'appointment') {
        deleteAppointment(deleteId);
      } else {
        deleteTask(deleteId);
      }
    }
    setDeleteId(null);
  };

  // Function to highlight dates with appointments
  const modifiers = {
    hasAppointment: (day: Date) => {
      const key = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
      return datesWithAppointments.includes(key);
    },
  };

  const modifiersStyles = {
    hasAppointment: {
      fontWeight: 'bold' as const,
      textDecoration: 'underline',
    },
  };

  return (
    <div className="flex flex-col min-h-screen relative page-enter">
      <div className="absolute inset-0 bg-gradient-mesh-vibrant pointer-events-none" />
      <PageHeader 
        title="Agenda" 
        description="Gerencie compromissos e tarefas"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadIcs(appointments)}
              disabled={appointments.length === 0}
              className="hidden sm:inline-flex"
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar .ics
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setEditingTask(null); setTaskFormOpen(true); }}>
              <Plus className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Nova Tarefa</span>
            </Button>
            <Button size="sm" onClick={() => { setEditingAppointment(null); setAppointmentFormOpen(true); }}>
              <Plus className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Novo Compromisso</span>
            </Button>
          </div>
        }
      />
      
      <div className="relative flex-1 p-4 sm:p-6">
        <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-[340px_1fr]">
          {/* Calendar */}
          <Card className="border-t-4 border-t-primary/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <CalendarIcon className="h-5 w-5 text-primary" />
                Calendário
              </CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center px-2 sm:px-4">
              <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
                className="rounded-md border w-full"
                locale={ptBR}
                modifiers={modifiers}
                modifiersStyles={modifiersStyles}
              />
            </CardContent>
          </Card>

          {/* Right Column - Appointments and Tasks */}
          <div className="space-y-4 sm:space-y-6">
            {/* Selected Date Appointments */}
            <Card className="border-t-4 border-t-info/40">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg capitalize">
                    {date ? format(date, "EEEE, d 'de' MMMM", { locale: ptBR }) : 'Compromissos'}
                  </CardTitle>
                  <Badge className={cn(
                    "font-medium",
                    selectedDateAppointments.length > 0 
                      ? "bg-primary/10 text-primary border-primary/20" 
                      : "bg-muted text-muted-foreground"
                  )}>
                    {selectedDateAppointments.length} agendado{selectedDateAppointments.length !== 1 ? 's' : ''}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {selectedDateAppointments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <CalendarIcon className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="font-medium text-muted-foreground">Nenhum compromisso para este dia</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Clique em "Novo Compromisso" para agendar
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedDateAppointments.map((appointment) => (
                      <AppointmentCard
                        key={appointment.id}
                        appointment={appointment}
                        onToggleComplete={(id, completed) => toggleAppointmentComplete({ id, completed })}
                        onEdit={handleEditAppointment}
                        onDelete={(id) => { setDeleteId(id); setDeleteType('appointment'); }}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Visits for selected date */}
            <ScheduleVisits selectedDate={date} />

            {/* Tasks */}
            <Card className="border-t-4 border-t-accent/40">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <ListTodo className="h-5 w-5 text-accent" />
                  Tarefas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="pending">
                  <TabsList className="mb-4">
                    <TabsTrigger value="pending">
                      Pendentes ({pendingTasks.length})
                    </TabsTrigger>
                    <TabsTrigger value="completed">
                      Concluídas ({completedTasks.length})
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="pending">
                    {pendingTasks.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <ListTodo className="h-12 w-12 text-muted-foreground mb-4" />
                        <h3 className="font-medium text-muted-foreground">Nenhuma tarefa pendente</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          Clique em "Nova Tarefa" para adicionar
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {pendingTasks.map((task) => (
                          <TaskCard
                            key={task.id}
                            task={task}
                            onToggleComplete={(id, completed) => toggleTaskComplete({ id, completed })}
                            onEdit={handleEditTask}
                            onDelete={(id) => { setDeleteId(id); setDeleteType('task'); }}
                          />
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="completed">
                    {completedTasks.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <CheckCircle2 className="h-12 w-12 text-muted-foreground mb-4" />
                        <h3 className="font-medium text-muted-foreground">Nenhuma tarefa concluída</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          Tarefas finalizadas aparecerão aqui
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {completedTasks.map((task) => (
                          <TaskCard
                            key={task.id}
                            task={task}
                            onToggleComplete={(id, completed) => toggleTaskComplete({ id, completed })}
                            onEdit={handleEditTask}
                            onDelete={(id) => { setDeleteId(id); setDeleteType('task'); }}
                          />
                        ))}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Forms */}
      <AppointmentForm
        open={appointmentFormOpen}
        onOpenChange={setAppointmentFormOpen}
        appointment={editingAppointment}
        selectedDate={date}
      />

      <TaskForm
        open={taskFormOpen}
        onOpenChange={setTaskFormOpen}
        task={editingTask}
      />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir {deleteType === 'appointment' ? 'este compromisso' : 'esta tarefa'}? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

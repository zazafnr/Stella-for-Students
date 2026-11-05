import SwiftUI
import PhotosUI

// Lernen: Lernkarten („Heute dran“, eine Karte nach der anderen) und Mitschriften aus Fotos.
// Gleiche Wege wie die Web-App: /api/students/cards, /api/students/decks, /api/students/summaries.
// Keine Punkte, keine Serien.

private struct StudyCard: Decodable, Identifiable, Hashable {
    var id: String
    var front: String
    var back: String
    var deckTitle: String?
}
private struct TodayResponse: Decodable { var due: Int; var cards: [StudyCard] }
private struct StudyDeck: Decodable, Identifiable, Hashable { var id: String; var title: String; var cards: Int; var due: Int }
private struct DecksResponse: Decodable { var decks: [StudyDeck] }
private struct GenerateResponse: Decodable { var added: [StudyCard] }
private struct NoteSummary: Decodable, Identifiable, Hashable {
    var id: String
    var title: String
    var subject: String?
    var text: String
    var openQuestions: [String]
    var status: String
    var progress: String?
    var error: String?
}
private struct SummariesResponse: Decodable { var summaries: [NoteSummary] }
private struct StartedResponse: Decodable { var id: String }
private struct AnswerBody: Encodable { var correct: Bool }
private struct GenerateBody: Encodable { var title: String; var text: String }
private struct SummaryBody: Encodable { var images: [String]; var subject: String? }
private struct ExamBody: Encodable { var examId: String }

@MainActor
struct LearnView: View {
    @Environment(Store.self) private var store

    @State private var due: TodayResponse?
    @State private var decks: [StudyDeck] = []
    @State private var summaries: [NoteSummary] = []
    @State private var queue: [StudyCard] = []
    @State private var practicing = false
    @State private var revealed = false
    @State private var showNewDeck = false
    @State private var error: String?
    @State private var picked: [PhotosPickerItem] = []
    @State private var subject = ""
    @State private var busy = false
    @State private var notice: String?

    private var exams: [Item] {
        store.visibleItems.filter { $0.kind == "exam" && $0.isOpen }.sorted { ($0.due ?? "") < ($1.due ?? "") }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    cardsSection.rise(0)
                    notesSection.rise(1)
                    if let error { Text(error).font(.system(size: 14)).foregroundStyle(Theme.pinkText) }
                    if let notice { Text(notice).font(.system(size: 14)).foregroundStyle(Theme.green) }
                }
                .padding(16)
            }
            .background(Theme.bg)
            .navigationTitle(L("nav.learn"))
            .refreshable { await loadAll() }
            .task {
                await loadAll()
                // läuft eine Mitschrift, alle paar Sekunden nachsehen
                while !Task.isCancelled {
                    try? await Task.sleep(for: .seconds(3))
                    if summaries.contains(where: { $0.status == "working" }) { await loadSummaries() }
                }
            }
            .sheet(isPresented: $showNewDeck) { NewDeckSheet { await loadAll() } }
            .fullScreenCover(isPresented: $practicing) { practiceView }
            .onChange(of: picked) { _, items in
                guard !items.isEmpty else { return }
                Task { await startSummary(items) }
            }
        }
    }

    // MARK: Karten

    private var cardsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(L("learn.cards.title")).font(.system(size: 20, weight: .bold)).foregroundStyle(Theme.text)
            if let due, due.due > 0 {
                HStack {
                    Text(L("cards.today", ["count": due.due])).font(.system(size: 16, weight: .semibold)).foregroundStyle(Theme.text)
                    Spacer()
                    Button(L("cards.start")) { queue = due.cards; revealed = false; practicing = true }
                        .buttonStyle(.borderedProminent)
                }
                .card()
            } else {
                Text(L("cards.none")).font(.system(size: 15)).foregroundStyle(Theme.muted)
            }
            if !decks.isEmpty {
                Text(L("cards.decks")).font(.system(size: 16, weight: .semibold)).foregroundStyle(Theme.text)
                ForEach(decks) { d in
                    HStack {
                        Text(d.title).font(.system(size: 15, weight: .semibold)).foregroundStyle(Theme.text)
                        Spacer()
                        Text(L("cards.deckLine", ["cards": d.cards, "due": d.due])).font(.system(size: 13)).foregroundStyle(Theme.muted)
                    }
                    .card(padding: 12)
                }
            }
            Button { showNewDeck = true } label: { Label(L("cards.new"), systemImage: "plus.circle") }
        }
    }

    private var practiceView: some View {
        VStack(spacing: 20) {
            HStack {
                Text("\(queue.count)").font(.system(size: 14)).foregroundStyle(Theme.muted)
                Spacer()
                Button(L("common.close")) { practicing = false; Task { await loadAll() } }
            }
            Spacer()
            if let card = queue.first {
                VStack(spacing: 14) {
                    Text(card.front).font(.system(size: 24, weight: .bold)).multilineTextAlignment(.center).foregroundStyle(Theme.text)
                    if revealed {
                        Divider()
                        Text(card.back).font(.system(size: 19)).multilineTextAlignment(.center).foregroundStyle(Theme.muted)
                    }
                }
                .frame(maxWidth: .infinity, minHeight: 200)
                .card(padding: 24)
                .onTapGesture { revealed = true }
                Spacer()
                if revealed {
                    HStack(spacing: 12) {
                        Button(L("cards.didnt")) { Task { await answer(false) } }.buttonStyle(.bordered)
                        Button(L("cards.knew")) { Task { await answer(true) } }.buttonStyle(.borderedProminent)
                    }
                    .controlSize(.large)
                } else {
                    Button(L("cards.show")) { revealed = true }.buttonStyle(.borderedProminent).controlSize(.large)
                }
            } else {
                Text(L("cards.done")).font(.system(size: 20, weight: .semibold)).foregroundStyle(Theme.text)
                Spacer()
            }
        }
        .padding(20)
        .background(Theme.bg)
    }

    private func answer(_ correct: Bool) async {
        guard let card = queue.first else { return }
        do {
            let _: OK = try await API.shared.send("POST", "/api/students/cards/\(card.id)/answer", body: AnswerBody(correct: correct))
            Haptics.soft()
        } catch { self.error = error.localizedDescription }
        revealed = false
        queue.removeFirst()
        if queue.isEmpty { await loadAll() }
    }

    // MARK: Mitschriften

    private var notesSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(L("notes.title")).font(.system(size: 20, weight: .bold)).foregroundStyle(Theme.text)
            TextField(L("notes.subject"), text: $subject).textFieldStyle(.roundedBorder)
            PhotosPicker(selection: $picked, maxSelectionCount: 8, matching: .images) {
                Label(L("notes.add"), systemImage: "camera.viewfinder")
            }
            .disabled(busy)
            if summaries.isEmpty { Text(L("notes.none")).font(.system(size: 15)).foregroundStyle(Theme.muted) }
            ForEach(summaries) { s in summaryCard(s) }
        }
    }

    private func summaryCard(_ s: NoteSummary) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(s.subject.map { "\(s.title) · \($0)" } ?? s.title).font(.system(size: 16, weight: .bold)).foregroundStyle(Theme.text)
            if s.status == "working" {
                HStack {
                    ProgressView()
                    Text(L("notes.working", ["progress": s.progress ?? ""])).font(.system(size: 14)).foregroundStyle(Theme.muted)
                    Spacer()
                    Button(L("notes.cancel")) { Task { await post("/api/students/summaries/\(s.id)/cancel") } }
                }
            } else if s.status == "failed" {
                Text(L("notes.failed", ["error": s.error ?? ""])).font(.system(size: 14)).foregroundStyle(Theme.pinkText)
                Button(L("notes.delete"), role: .destructive) { Task { await remove(s.id) } }
            } else {
                Text(s.text).font(.system(size: 15)).foregroundStyle(Theme.text)
                if !s.openQuestions.isEmpty {
                    Text(L("notes.open")).font(.system(size: 13, weight: .semibold)).foregroundStyle(Theme.muted)
                    ForEach(s.openQuestions, id: \.self) { q in Text("• " + q).font(.system(size: 14)).foregroundStyle(Theme.muted) }
                }
                HStack(spacing: 14) {
                    Button(L("notes.toCards")) { Task { await toCards(s.id) } }
                    Button(L("notes.toNotebook")) { Task { await post("/api/students/summaries/\(s.id)/notebook"); notice = L("notes.queued") } }
                }
                .font(.system(size: 14, weight: .semibold))
                if !exams.isEmpty {
                    Menu(L("notes.toExam")) {
                        ForEach(exams) { e in
                            Button(e.title) { Task { await toExam(s.id, e.id) } }
                        }
                    }
                    .font(.system(size: 14, weight: .semibold))
                }
                Button(L("notes.delete"), role: .destructive) { Task { await remove(s.id) } }.font(.system(size: 13))
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .card()
    }

    private func startSummary(_ items: [PhotosPickerItem]) async {
        busy = true
        defer { busy = false; picked = [] }
        var images: [String] = []
        for item in items {
            if let data = try? await item.loadTransferable(type: Data.self), let ui = UIImage(data: data), let jpeg = ui.jpegForUpload() {
                images.append("data:image/jpeg;base64,\(jpeg.base64EncodedString())")
            }
        }
        guard !images.isEmpty else { return }
        do {
            let subj = subject.trimmingCharacters(in: .whitespaces)
            let _: StartedResponse = try await API.shared.send("POST", "/api/students/summaries", body: SummaryBody(images: images, subject: subj.isEmpty ? nil : subj))
            subject = ""
            error = nil
            await loadSummaries()
        } catch { self.error = error.localizedDescription }
    }

    private func toCards(_ id: String) async {
        do {
            let r: GenerateResponse = try await API.shared.send("POST", "/api/students/summaries/\(id)/cards")
            notice = L("cards.added", ["count": r.added.count])
            error = nil
            await loadAll()
        } catch { self.error = error.localizedDescription }
    }

    private func toExam(_ id: String, _ examId: String) async {
        do {
            let _: OK = try await API.shared.send("POST", "/api/students/summaries/\(id)/exam", body: ExamBody(examId: examId))
            error = nil
        } catch { self.error = error.localizedDescription }
    }

    private func post(_ path: String) async {
        do {
            let _: OK = try await API.shared.send("POST", path)
            error = nil
            await loadSummaries()
        } catch { self.error = error.localizedDescription }
    }

    private func remove(_ id: String) async {
        do {
            let _: OK = try await API.shared.send("DELETE", "/api/students/summaries/\(id)")
            await loadSummaries()
        } catch { self.error = error.localizedDescription }
    }

    // MARK: Laden

    private func loadAll() async {
        do {
            due = try await API.shared.get("/api/students/cards/today")
            let d: DecksResponse = try await API.shared.get("/api/students/decks")
            decks = d.decks
            error = nil
        } catch { if due == nil { self.error = error.localizedDescription } }
        await loadSummaries()
    }

    private func loadSummaries() async {
        if let r: SummariesResponse = try? await API.shared.get("/api/students/summaries") { summaries = r.summaries }
    }
}

/// Neuer Stapel aus eingefügtem Text (höchstens 40 Karten je Aufruf)
@MainActor
private struct NewDeckSheet: View {
    @Environment(\.dismiss) private var dismiss
    var done: () async -> Void
    init(done: @escaping () async -> Void) { self.done = done }
    @State private var title = ""
    @State private var text = ""
    @State private var busy = false
    @State private var error: String?

    var body: some View {
        NavigationStack {
            Form {
                Section { TextField(L("cards.titleField"), text: $title) }
                Section(L("cards.textField")) { TextEditor(text: $text).frame(minHeight: 180) }
                if let error { Section { Text(error).foregroundStyle(Theme.pinkText) } }
            }
            .navigationTitle(L("cards.new"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button(L("common.cancel")) { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button(busy ? L("cards.generating") : L("cards.generate")) { Task { await generate() } }
                        .disabled(busy || title.trimmingCharacters(in: .whitespaces).isEmpty || text.count < 20)
                }
            }
        }
    }

    private func generate() async {
        busy = true
        defer { busy = false }
        do {
            let _: GenerateResponse = try await API.shared.send("POST", "/api/students/decks/generate", body: GenerateBody(title: title, text: text))
            await done()
            dismiss()
        } catch { self.error = error.localizedDescription }
    }
}
